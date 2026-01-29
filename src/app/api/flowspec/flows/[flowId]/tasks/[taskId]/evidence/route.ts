/**
 * Task Evidence API
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiList } from "@/lib/api-utils";
import { getFlow, attachEvidence } from "@/lib/flowspec/engine";
import { getTaskEvidence } from "@/lib/flowspec/truth";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string; taskId: string }>;
};

/**
 * List all Evidence attached to a Task.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { flowId, taskId } = await params;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(flow.workflow.companyId);

    const evidence = await getTaskEvidence(flowId, taskId);

    return apiList(evidence, evidence.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Attach Evidence to a Task.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { flowId, taskId } = await params;
    const body = await request.json();
    const { type, data, idempotencyKey } = body;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    await verifyTenantOwnership(flow.workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    if (!type || !data) {
      return apiError("INPUT_REQUIRED", "type and data are required");
    }

    const result = await attachEvidence(
      flowId,
      taskId,
      type,
      data,
      session.userId,
      idempotencyKey
    );

    if (result.error) {
      return apiError(result.error.code, result.error.message, result.error.details);
    }

    return apiSuccess({ evidence: result.evidenceAttachment }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
