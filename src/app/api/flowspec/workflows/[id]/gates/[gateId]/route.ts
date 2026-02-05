/**
 * Gate API - Update, Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.5
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { updateGateInBuffer, deleteGateFromBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; gateId: string }>;
};

/**
 * Update a Gate.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, gateId } = await params;
    const body = await request.json();
    const { targetNodeId } = body;

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

    // Gate updates are semantic changes. Stage them in the buffer.
    const updates: any = {};
    if (targetNodeId !== undefined) updates.targetNodeId = targetNodeId;

    const updatedBuffer = await updateGateInBuffer(workflowId, companyId, gateId, updates, userId);
    const content = updatedBuffer.content as any;
    const updatedGate = content.gates.find((g: any) => g.id === gateId);

    return apiSuccess({ gate: updatedGate, message: "Gate update staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete a Gate.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, gateId } = await params;

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

    // Gate deletion is a semantic change. Stage it in the buffer.
    await deleteGateFromBuffer(workflowId, companyId, gateId, userId);

    return apiSuccess({ success: true, message: "Gate deletion staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
