/**
 * Task Outcome API
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getFlow, recordOutcome } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string; taskId: string }>;
};

/**
 * Record an Outcome for a Task.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { flowId, taskId } = await params;
    const body = await request.json();
    const { outcome, detourId, metadata } = body;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    await verifyTenantOwnership(flow.workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    if (!outcome) {
      return apiError("INPUT_REQUIRED", "outcome is required");
    }

    const result = await recordOutcome(
      flowId,
      taskId,
      outcome,
      session.userId,
      detourId,
      metadata
    );

    if (!result.success && result.error) {
      return apiError(result.error.code, result.error.message, result.error.details);
    }

    return apiSuccess({
      success: true,
      taskExecutionId: result.taskExecutionId,
      gateResults: result.gateResults,
    });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
