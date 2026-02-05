/**
 * Task API - Create
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.3
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { addTaskToBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string }>;
};

/**
 * Create a new Task in a Node.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId } = await params;
    const body = await request.json();
    const { name, instructions, evidenceRequired, evidenceSchema, displayOrder } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { companyId, userId } = await verifyTenantOwnership(workflow.companyId);

    // INV-026 Enforcement: Auto-revert VALIDATED to DRAFT (Policy B)
    try {
      await ensureDraftForStructuralEdit(workflowId);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
    }

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.workflowId !== workflowId) {
      return apiError("NODE_NOT_FOUND", "Node not found", null, 404);
    }

    if (!name) {
      return apiError("NAME_REQUIRED", "Task name is required");
    }

    // Creating a task is a semantic change. Stage it in the buffer.
    const taskData = {
      name,
      instructions,
      evidenceRequired: evidenceRequired ?? false,
      evidenceSchema: evidenceSchema ?? undefined,
      displayOrder: displayOrder ?? 0,
    };

    const updatedBuffer = await addTaskToBuffer(workflowId, companyId, nodeId, taskData, userId);
    const content = updatedBuffer.content as any;
    const nodeInContent = content.nodes.find((n: any) => n.id === nodeId);
    const newTask = nodeInContent.tasks[nodeInContent.tasks.length - 1];

    return apiSuccess({ task: newTask, message: "Task creation staged to draft buffer" }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
