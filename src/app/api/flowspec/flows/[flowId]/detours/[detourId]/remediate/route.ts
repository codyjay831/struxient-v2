import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getFlow, triggerRemediation } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string; detourId: string }>;
};

/**
 * Convert a Detour to Remediation (CONVERTED).
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { flowId, detourId } = await params;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    await verifyTenantOwnership(flow.workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    await triggerRemediation(detourId, session.userId);

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
