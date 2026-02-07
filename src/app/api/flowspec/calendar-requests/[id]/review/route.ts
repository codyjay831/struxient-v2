/**
 * Calendar Request Review API - Review and process ScheduleChangeRequests
 * Canon: 01_scheduling_invariants_and_guards.canon.md
 * Rule: Phase E2a - Transition status and open detour, no ScheduleBlock mutation.
 */

import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { openDetour } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const { companyId, memberId, authority } = await getActorTenantContext();
    
    const body = await request.json();
    const { action, checkpointNodeId, resumeTargetNodeId, checkpointTaskExecutionId, type, category } = body;

    const changeRequest = await prisma.scheduleChangeRequest.findUnique({
      where: { id },
    });

    if (!changeRequest) {
      return apiError("NOT_FOUND", "Schedule change request not found.", null, 404);
    }

    // Tenant Isolation
    if (changeRequest.companyId !== companyId) {
      return apiError("FORBIDDEN", "Unauthorized access to schedule change request.", null, 403);
    }

    if (action === "start_review") {
      if (changeRequest.status !== "PENDING") {
        return apiError("INVALID_TRANSITION", `Cannot start review from status ${changeRequest.status}`, null, 400);
      }

      const updated = await prisma.scheduleChangeRequest.update({
        where: { id },
        data: {
          status: "IN_REVIEW",
          reviewedBy: memberId,
          reviewedAt: new Date(),
        }
      });

      return apiSuccess({ changeRequest: updated }, 200, authority);
    }

    if (action === "accept") {
      if (changeRequest.status !== "IN_REVIEW" && changeRequest.status !== "PENDING") {
        return apiError("INVALID_TRANSITION", `Cannot accept from status ${changeRequest.status}`, null, 400);
      }

      if (!changeRequest.flowId) {
        return apiError("INPUT_REQUIRED", "Schedule change request must be linked to a flow to open a detour.", null, 400);
      }

      if (!checkpointNodeId || !resumeTargetNodeId || !checkpointTaskExecutionId) {
        return apiError("INPUT_REQUIRED", "checkpointNodeId, resumeTargetNodeId, and checkpointTaskExecutionId are required to open a detour.", null, 400);
      }

      // Open the detour via FlowSpec Engine
      // This enforces Right Control (human confirmation path)
      const detour = await openDetour(
        changeRequest.flowId,
        checkpointNodeId,
        resumeTargetNodeId,
        memberId,
        checkpointTaskExecutionId,
        type || "NON_BLOCKING",
        category || "SCHEDULE_CHANGE"
      );

      const updated = await prisma.scheduleChangeRequest.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          detourRecordId: detour.id,
          reviewedBy: memberId,
          reviewedAt: new Date(),
        }
      });

      return apiSuccess({ changeRequest: updated, detourId: detour.id }, 200, authority);
    }

    return apiError("INVALID_ACTION", `Action ${action} is not recognized.`, null, 400);
  } catch (error) {
    return apiRouteError(error);
  }
}
