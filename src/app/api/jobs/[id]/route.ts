import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Fetch Job + Customer metadata.
 * GET /api/jobs/[id]
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        flowGroup: {
          include: {
            flows: {
              where: {
                status: { in: ["ACTIVE", "SUSPENDED"] }
              }
            }
          }
        }
      },
    });

    if (!job) {
      return apiError("JOB_NOT_FOUND", "Job not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(job.companyId);

    return apiSuccess({ job }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
