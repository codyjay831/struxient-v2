/**
 * Node API - Create
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.2
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { addNodeToBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Create a new Node in a Workflow.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { name, isEntry, nodeKind, completionRule, position } = body;

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
      return apiError("NAME_REQUIRED", "Node name is required");
    }

    // Creating a node is a semantic change. Stage it in the buffer.
    const nodeData = {
      name,
      isEntry: isEntry ?? false,
      nodeKind: nodeKind ?? "MAINLINE",
      completionRule: completionRule ?? "ALL_TASKS_DONE",
      position: position ?? { x: 0, y: 0 },
    };

    const updatedBuffer = await addNodeToBuffer(workflowId, companyId, nodeData, userId);
    const content = updatedBuffer.content as any;
    const newNode = content.nodes[content.nodes.length - 1];

    return apiSuccess({ node: newNode, message: "Node creation staged to draft buffer" }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
