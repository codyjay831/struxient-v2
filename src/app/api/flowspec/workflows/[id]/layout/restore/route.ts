/**
 * Bulk Layout Restore API
 * 
 * Updates node positions in bulk.
 * Payload: { positions: Record<nodeId, {x: number, y: number}> }
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { positions } = body;

    if (!positions || typeof positions !== "object") {
      return apiError("INVALID_PAYLOAD", "Positions record is required");
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { companyId: true }
    });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // Bulk update in a transaction using updateMany for safe scoping.
    // This ensures that even if a nodeId from another workflow is provided, 
    // it will not be updated because the where clause filters by workflowId.
    await prisma.$transaction(
      Object.entries(positions).map(([nodeId, position]) =>
        prisma.node.updateMany({
          where: { 
            id: nodeId,
            workflowId
          },
          data: { position: position as any }
        })
      )
    );

    return apiSuccess({ message: "Layout restored successfully" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
