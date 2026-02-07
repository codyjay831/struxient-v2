/**
 * Calendar Requests API - Create a ScheduleChangeRequest
 * Canon: 01_scheduling_invariants_and_guards.canon.md
 * Rule: Phase E1 - Intent capture only, no mutation of ScheduleBlock.
 */

import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { companyId, memberId, authority } = await getActorTenantContext();
    
    const body = await request.json();
    const { 
      taskId, 
      flowId, 
      detourRecordId, 
      timeClass, 
      reason, 
      metadata 
    } = body;

    // Validation
    if (!reason) {
      return apiError("VALIDATION_ERROR", "Reason is required for a schedule change request.", null, 400);
    }

    // Phase E1: Create the request record. 
    // This MUST NOT mutate any ScheduleBlock records.
    const changeRequest = await prisma.scheduleChangeRequest.create({
      data: {
        companyId,
        taskId,
        flowId,
        detourRecordId,
        timeClass: timeClass || 'PLANNED',
        reason,
        metadata: metadata || {},
        status: 'PENDING',
        requestedBy: memberId, // Human actor attribution
      }
    });

    return apiSuccess({ changeRequest }, 201, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
