import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiList } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * List all FlowGroups for the actor's tenant.
 * GET /api/flowspec/flow-groups
 */
export async function GET() {
  try {
    const { companyId, authority } = await getActorTenantContext();

    const flowGroups = await prisma.flowGroup.findMany({
      where: { companyId },
      include: {
        job: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return apiList(flowGroups, flowGroups.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
