/**
 * Task Start API
 *
 * Canon Source: 30_workstation_ui_api_map.md §2.5
 * 
 * Marks a Task as started, which is required before an Outcome can be recorded.
 * INV-022: Actionability constraints evaluated at Task start only.
 */

import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getFlow, startTask } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string; taskId: string }>;
};

/**
 * Start a Task (mark as in-progress).
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { flowId, taskId } = await params;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    await verifyTenantOwnership(flow.workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    const result = await startTask(flowId, taskId, session.userId);

    if (!result.success && result.error) {
      return apiError(result.error.code, result.error.message, result.error.details);
    }

    return apiSuccess({
      success: true,
      taskExecutionId: result.taskExecutionId,
    });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
