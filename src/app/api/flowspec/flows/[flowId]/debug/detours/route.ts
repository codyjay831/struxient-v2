import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiList } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string }>;
};

/**
 * List all Detours for a Flow (Debug).
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { flowId } = await params;

    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: { workflow: true }
    });
    
    if (!flow) return apiList([], 0);

    await verifyTenantOwnership(flow.workflow.companyId);

    const detours = await prisma.detourRecord.findMany({
      where: { flowId },
      orderBy: { openedAt: "desc" }
    });

    return apiList(detours, detours.length);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
