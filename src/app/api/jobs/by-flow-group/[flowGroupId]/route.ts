import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowGroupId: string }>;
};

/**
 * Resolve Job from FlowGroup.
 * GET /api/jobs/by-flow-group/[flowGroupId]
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { flowGroupId } = await params;

    const job = await prisma.job.findUnique({
      where: { flowGroupId },
      include: {
        customer: true,
      },
    });

    if (!job) {
      return apiError("JOB_NOT_FOUND", "Job metadata not configured for this FlowGroup", null, 404);
    }

    const { authority } = await verifyTenantOwnership(job.companyId);

    return apiSuccess({ job }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
