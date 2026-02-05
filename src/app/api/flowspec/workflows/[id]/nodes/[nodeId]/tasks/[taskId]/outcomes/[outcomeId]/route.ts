/**
 * Outcome API - Update, Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { updateOutcomeInBuffer, deleteOutcomeFromBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string; taskId: string; outcomeId: string }>;
};

/**
 * Update an Outcome.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId, outcomeId } = await params;
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

    // Outcome updates are semantic changes. Stage them in the buffer.
    const updates: any = {};
    if (name !== undefined) updates.name = name;

    const updatedBuffer = await updateOutcomeInBuffer(
      workflowId,
      companyId,
      nodeId,
      taskId,
      outcomeId,
      updates,
      userId
    );
    
    const content = updatedBuffer.content as any;
    const nodeInContent = content.nodes.find((n: any) => n.id === nodeId);
    const taskInContent = nodeInContent.tasks.find((t: any) => t.id === taskId);
    const updatedOutcome = taskInContent.outcomes.find((o: any) => o.id === outcomeId);

    return apiSuccess({ outcome: updatedOutcome, message: "Outcome update staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete an Outcome.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId, outcomeId } = await params;

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

    // Outcome deletion is a semantic change. Stage it in the buffer.
    await deleteOutcomeFromBuffer(workflowId, companyId, nodeId, taskId, outcomeId, userId);

    return apiSuccess({ success: true, message: "Outcome deletion staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
