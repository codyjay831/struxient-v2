import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiList } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * List jobs for actor's tenant or create a new job.
 * GET /api/jobs
 * POST /api/jobs
 */

export async function GET() {
  try {
    const { companyId, authority } = await getActorTenantContext();

    const jobs = await prisma.job.findMany({
      where: { companyId },
      include: {
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return apiList(jobs, jobs.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Create a new Job metadata record.
 * POST /api/jobs
 * 
 * Body: { customerId: string, flowGroupId: string, address?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    const body = await request.json();
    const { customerId, flowGroupId, address } = body;

    // 1. Validation
    if (!customerId || !flowGroupId) {
      return apiError("INVALID_INPUT", "customerId and flowGroupId are required");
    }

    // 2. Verify FlowGroup existence and tenancy
    const flowGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
    });

    if (!flowGroup) {
      return apiError("FLOW_GROUP_NOT_FOUND", "Specified FlowGroup does not exist", null, 404);
    }

    if (flowGroup.companyId !== companyId) {
      return apiError("FORBIDDEN", "FlowGroup belongs to a different tenant", null, 403);
    }

    // 3. Verify Customer existence and tenancy
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError("CUSTOMER_NOT_FOUND", "Specified customer does not exist", null, 404);
    }

    if (customer.companyId !== companyId) {
      return apiError("FORBIDDEN", "Customer belongs to a different tenant", null, 403);
    }

    // 4. Create Job
    const job = await prisma.job.create({
      data: {
        companyId,
        customerId,
        flowGroupId,
        address: address || null,
      },
      include: {
        customer: true,
      },
    });

    return apiSuccess({ job }, 201, authority);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Unique constraint violation on flowGroupId
      if (error.code === "P2002") {
        return apiError("JOB_ALREADY_EXISTS", "A job record already exists for this FlowGroup", null, 409);
      }
    }
    return tenantErrorResponse(error);
  }
}
