import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { createFlow } from "@/lib/flowspec/instantiation";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Atomic start for non-sales jobs (Sales OFF).
 * Creates FlowGroup (exec_), Job, and Anchor Flow with Anchor Identity.
 * 
 * POST /api/jobs/start-execution
 * Body: { customerId: string, address: string, workflowIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, userId, authority } = await getActorTenantContext();
    const body = await request.json();
    const { customerId, address, workflowIds } = body;

    // 1. Validation
    if (!customerId || !workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return apiError("INVALID_INPUT", "customerId and workflowIds (array) are required");
    }

    // 2. Verify Customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.companyId !== companyId) {
      return apiError("CUSTOMER_NOT_FOUND", "Customer not found", null, 404);
    }

    // 3. Generate deterministic exec_ ID
    const executionId = `exec_${randomUUID()}`;
    const scope = { type: "job", id: executionId };

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

      // b. Create Job
      const job = await tx.job.create({
        data: {
          companyId,
          customerId,
          flowGroupId: flowGroup.id,
          address,
        },
      });

      // c. Instantiate workflows (first one is Anchor)
      const flows = [];
      for (let i = 0; i < workflowIds.length; i++) {
        const wfId = workflowIds[i];
        const isAnchor = i === 0;

        const res = await createFlow(
          wfId,
          scope,
          companyId,
          {
            flowGroupId: flowGroup.id,
            initialEvidence: isAnchor ? {
              data: { customerId },
              attachedBy: userId,
            } : undefined,
          },
          tx
        );

        if (!res.success) {
          throw new Error(res.error?.message || `Failed to instantiate workflow ${wfId}`);
        }
        flows.push(res);
      }

      return { job, flowGroup, flows };
    });

    return apiSuccess(result, 201, authority);
  } catch (error) {
    console.error("[StartExecution Error]:", error);
    if (error instanceof Error && (error.message.includes("ANCHOR_TASK_MISSING") || error.message.includes("WORKFLOW_NOT_PUBLISHED"))) {
        return apiError("EXECUTION_START_FAILED", error.message);
    }
    return tenantErrorResponse(error);
  }
}
