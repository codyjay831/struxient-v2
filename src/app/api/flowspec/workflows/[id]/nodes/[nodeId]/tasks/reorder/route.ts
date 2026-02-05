/**
 * Task API - Reorder
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.3
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { reorderTasksInBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string }>;
};

/**
 * Reorder Tasks within a Node.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId } = await params;
    const body = await request.json();
    const { order } = body; // Array of task IDs in desired order

    if (!Array.isArray(order)) {
      return apiError("INVALID_INPUT", "Order must be an array of task IDs");
    }

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

    // Task reordering is a semantic change. Stage it in the buffer.
    const updatedBuffer = await reorderTasksInBuffer(workflowId, companyId, nodeId, order, userId);
    const content = updatedBuffer.content as any;
    const nodeInContent = content.nodes.find((n: any) => n.id === nodeId);
    const updatedTasks = nodeInContent.tasks;

    return apiSuccess({ tasks: updatedTasks, message: "Task reordering staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
