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

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    const gate = await prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate || gate.workflowId !== workflowId) {
      return apiError("GATE_NOT_FOUND", "Gate not found", null, 404);
    }

    // Verify target node exists (if not terminal)
    if (targetNodeId !== undefined && targetNodeId !== null) {
      const targetNode = await prisma.node.findUnique({ where: { id: targetNodeId } });
      if (!targetNode || targetNode.workflowId !== workflowId) {
        return apiError("NODE_NOT_FOUND", `Target node ${targetNodeId} not found`);
      }
    }

    const updated = await prisma.gate.update({
      where: { id: gateId },
      data: {
        targetNodeId: targetNodeId === undefined ? undefined : targetNodeId,
      },
    });

    return apiSuccess({ gate: updated });
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

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    const gate = await prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate || gate.workflowId !== workflowId) {
      return apiError("GATE_NOT_FOUND", "Gate not found", null, 404);
    }

    await prisma.gate.delete({ where: { id: gateId } });

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
