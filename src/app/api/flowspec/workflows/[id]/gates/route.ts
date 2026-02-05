/**
 * Gate API - Create
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.5
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";
import { addGateToBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Create a new Gate/route.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { sourceNodeId, outcomeName, targetNodeId } = body;

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

    if (!sourceNodeId || !outcomeName) {
      return apiError("INPUT_REQUIRED", "sourceNodeId and outcomeName are required");
    }

    // Creating a gate is a semantic change. Stage it in the buffer.
    const gateData = {
      sourceNodeId,
      outcomeName,
      targetNodeId,
    };

    const updatedBuffer = await addGateToBuffer(workflowId, companyId, gateData, userId);
    const content = updatedBuffer.content as any;
    const newGate = content.gates[content.gates.length - 1];

    return apiSuccess({ gate: newGate, message: "Gate creation staged to draft buffer" }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
