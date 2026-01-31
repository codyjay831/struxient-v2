import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { FlowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Customer Summary Projection: customer + list of jobs + derived signal per job.
 * GET /api/customers/[id]/summary
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const { companyId, authority } = await getActorTenantContext();

    const customer = await prisma.customer.findUnique({
      where: { id, companyId },
      include: {
        jobs: {
          include: {
            flowGroup: {
              include: {
                flows: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return apiError("CUSTOMER_NOT_FOUND", "Customer not found", null, 404);
    }

    const jobsWithSignals = customer.jobs.map((job) => {
      const flowStatuses = job.flowGroup.flows.map((f) => f.status);
      
      let derivedSignal = "ACTIVE";
      if (flowStatuses.length > 0) {
        if (flowStatuses.every((s) => s === FlowStatus.COMPLETED)) {
          derivedSignal = "COMPLETED";
        } else if (flowStatuses.some((s) => s === FlowStatus.BLOCKED)) {
          derivedSignal = "BLOCKED";
        } else if (flowStatuses.some((s) => s === FlowStatus.SUSPENDED)) {
          derivedSignal = "SUSPENDED";
        }
      }

      return {
        id: job.id,
        address: job.address,
        createdAt: job.createdAt,
        flowGroupId: job.flowGroupId,
        derivedSignal,
      };
    });

    const summary = {
      id: customer.id,
      name: customer.name,
      jobs: jobsWithSignals,
    };

    return apiSuccess({ summary }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
