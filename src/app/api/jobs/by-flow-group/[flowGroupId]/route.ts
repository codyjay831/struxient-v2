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

    const flowGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
    });

    if (!flowGroup) {
      return apiError("FLOW_GROUP_NOT_FOUND", "Flow Group not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(flowGroup.companyId);

    const [job, blockedFlows] = await Promise.all([
      prisma.job.findUnique({
        where: { flowGroupId },
        include: {
          customer: true,
        },
      }),
      prisma.flow.findMany({
        where: {
          flowGroupId,
          status: "BLOCKED",
        },
        select: {
          id: true,
          workflowId: true,
          workflow: { select: { name: true } },
        },
      }),
    ]);

    return apiSuccess({ 
      job: job || null, 
      isBlocked: blockedFlows.length > 0,
      blockedFlows: blockedFlows.map(f => ({
        id: f.id,
        workflowName: f.workflow.name
      }))
    }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
