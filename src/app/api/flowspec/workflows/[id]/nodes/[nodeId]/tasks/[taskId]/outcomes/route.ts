/**
 * Outcome API - Add
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { addOutcomeToBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string; taskId: string }>;
};

/**
 * Add an Outcome to a Task.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;
    const body = await request.json();
    const { name } = body;

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

    if (!name) {
      return apiError("NAME_REQUIRED", "Outcome name is required");
    }

    // Adding an outcome is a semantic change. Stage it in the buffer.
    const outcomeData = { name };

    const updatedBuffer = await addOutcomeToBuffer(
      workflowId,
      companyId,
      nodeId,
      taskId,
      outcomeData,
      userId
    );
    
    const content = updatedBuffer.content as any;
    const nodeInContent = content.nodes.find((n: any) => n.id === nodeId);
    const taskInContent = nodeInContent.tasks.find((t: any) => t.id === taskId);
    const newOutcome = taskInContent.outcomes[taskInContent.outcomes.length - 1];

    return apiSuccess({ outcome: newOutcome, message: "Outcome addition staged to draft buffer" }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
