/**
 * Task API - Update, Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.3
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { updateTaskInBuffer, deleteTaskFromBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string; taskId: string }>;
};

/**
 * Update a Task.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;
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

    // Task updates are semantic changes. Stage them in the buffer.
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (instructions !== undefined) updates.instructions = instructions;
    if (evidenceRequired !== undefined) updates.evidenceRequired = evidenceRequired;
    if (evidenceSchema !== undefined) updates.evidenceSchema = evidenceSchema;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;

    const updatedBuffer = await updateTaskInBuffer(workflowId, companyId, nodeId, taskId, updates, userId);
    const content = updatedBuffer.content as any;
    const nodeInContent = content.nodes.find((n: any) => n.id === nodeId);
    const updatedTask = nodeInContent.tasks.find((t: any) => t.id === taskId);

    return apiSuccess({ task: updatedTask, message: "Task update staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete a Task.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;

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

    // Task deletion is a semantic change. Stage it in the buffer.
    await deleteTaskFromBuffer(workflowId, companyId, nodeId, taskId, userId);

    return apiSuccess({ success: true, message: "Task deletion staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
