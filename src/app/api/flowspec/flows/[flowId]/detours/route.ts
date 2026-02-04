import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getFlow, openDetour } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string }>;
};

/**
 * Open a Detour for a Flow.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { flowId } = await params;
    const body = await request.json();
    const { checkpointNodeId, checkpointTaskExecutionId, resumeTargetNodeId, type, category } = body;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    await verifyTenantOwnership(flow.workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    if (!checkpointNodeId || !resumeTargetNodeId || !checkpointTaskExecutionId) {
      return apiError("INPUT_REQUIRED", "checkpointNodeId, resumeTargetNodeId, and checkpointTaskExecutionId are required");
    }

    const result = await openDetour(
      flowId,
      checkpointNodeId,
      resumeTargetNodeId,
      session.userId,
      checkpointTaskExecutionId,
      type,
      category
    );

    return apiSuccess({
      success: true,
      detourId: result.id,
    });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
