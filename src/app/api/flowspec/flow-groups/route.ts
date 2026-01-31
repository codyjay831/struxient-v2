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
        flows: {
          where: { status: "BLOCKED" },
          select: { id: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    /**
     * DRIFT FUSE: isBlocked is a projection-only field derived from child Flow statuses.
     * It must NEVER be used as a primary execution authority or source of truth for mutation rules.
     * It exists solely to surface execution halts to dashboard lenses.
     */
    const items = flowGroups.map(fg => ({
      ...fg,
      isBlocked: fg.flows.length > 0,
      flows: undefined // Remove flows from list payload to keep it light
    }));

    return apiList(items, items.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
