import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { createFlow } from "@/lib/flowspec/instantiation";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Initialize a sales-tracked opportunity (Sales ON).
 * Creates FlowGroup (oppty_) and Anchor Flow (Sales Flow) with Anchor Identity.
 * 
 * POST /api/sales/start-opportunity
 * Body: { customerId: string, salesWorkflowId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, userId, authority } = await getActorTenantContext();
    const body = await request.json();
    const { customerId, salesWorkflowId } = body;

    // 1. Validation
    if (!customerId || !salesWorkflowId) {
      return apiError("INVALID_INPUT", "customerId and salesWorkflowId are required");
    }

    // 2. Verify Customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.companyId !== companyId) {
      return apiError("CUSTOMER_NOT_FOUND", "Customer not found", null, 404);
    }

    // 3. Generate deterministic oppty_ ID
    const opportunityId = `oppty_${randomUUID()}`;
    const scope = { type: "opportunity", id: opportunityId };

    // 4. Atomic Action via Transaction
    const result = await prisma.$transaction(async (tx) => {
      // a. Create FlowGroup
      const flowGroup = await tx.flowGroup.create({
        data: {
          companyId,
          scopeType: scope.type,
          scopeId: scope.id,
        },
      });

      // b. Instantiate Sales Workflow (Anchor)
      const res = await createFlow(
        salesWorkflowId,
        scope,
        companyId,
        {
          flowGroupId: flowGroup.id,
          initialEvidence: {
            data: { customerId },
            attachedBy: userId,
          },
        },
        tx
      );

      if (!res.success) {
        throw new Error(res.error?.message || `Failed to instantiate sales workflow ${salesWorkflowId}`);
      }

      return { flowGroup, flow: res };
    });

    return apiSuccess(result, 201, authority);
  } catch (error) {
    console.error("[StartOpportunity Error]:", error);
    if (error instanceof Error && (error.message.includes("ANCHOR_TASK_MISSING") || error.message.includes("WORKFLOW_NOT_PUBLISHED"))) {
        return apiError("OPPORTUNITY_START_FAILED", error.message);
    }
    return tenantErrorResponse(error);
  }
}
