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

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Mutations allowed only in DRAFT state
    if (workflow.status !== WorkflowStatus.DRAFT) {
      return apiError(
        "WORKFLOW_NOT_EDITABLE",
        `Workflow is in ${workflow.status} state and cannot be modified. Revert to Draft to edit.`,
        null,
        403
      );
    }

    if (!sourceNodeId || !outcomeName) {
      return apiError("INPUT_REQUIRED", "sourceNodeId and outcomeName are required");
    }

    // Verify source node exists
    const sourceNode = await prisma.node.findUnique({ where: { id: sourceNodeId } });
    if (!sourceNode || sourceNode.workflowId !== workflowId) {
      return apiError("NODE_NOT_FOUND", `Source node ${sourceNodeId} not found`);
    }

    // Verify target node exists (if not terminal)
    if (targetNodeId !== null) {
      const targetNode = await prisma.node.findUnique({ where: { id: targetNodeId } });
      if (!targetNode || targetNode.workflowId !== workflowId) {
        return apiError("NODE_NOT_FOUND", `Target node ${targetNodeId} not found`);
      }
    }

    // Check for duplicate route (INV-024: Gate key is Node-level)
    const existing = await prisma.gate.findFirst({
      where: { workflowId, sourceNodeId, outcomeName },
    });

    if (existing) {
      return apiError("ROUTE_EXISTS", `A route for outcome "${outcomeName}" already exists in this node`);
    }

    const gate = await prisma.gate.create({
      data: {
        workflowId,
        sourceNodeId,
        outcomeName,
        targetNodeId,
      },
    });

    return apiSuccess({ gate }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
