/**
 * Job Assignments API
 * 
 * GET  /api/jobs/[id]/assignments - Returns current assignments
 * POST /api/jobs/[id]/assignments - Creates a new assignment
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse, getActorTenantContext } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { assignJobSlot, getCurrentJobAssignments } from "@/lib/responsibility/operations";
import { AssigneeType } from "@/lib/responsibility/constants";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * GET current assignments for a job
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: jobId } = await params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { companyId: true }
    });

    if (!job) {
      return apiError("JOB_NOT_FOUND", "Job not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(job.companyId);

    const assignments = await getCurrentJobAssignments(jobId);

    // Shape the response for minimal details as requested
    const items = assignments.map(a => ({
      id: a.id,
      slotKey: a.slotKey,
      assigneeType: a.assigneeType,
      member: a.member ? {
        id: a.member.id,
        role: a.member.role,
        userId: a.member.userId,
      } : null,
      externalParty: a.externalParty ? {
        id: a.externalParty.id,
        name: a.externalParty.name,
      } : null,
      assignedByMemberId: a.assignedByMemberId,
      createdAt: a.createdAt,
    }));

    return apiSuccess({ items }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * POST a new assignment
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: jobId } = await params;
    const body = await request.json();
    const { slotKey, assigneeType, memberId, externalPartyId } = body;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { companyId: true }
    });

    if (!job) {
      return apiError("JOB_NOT_FOUND", "Job not found", null, 404);
    }

    // Verify tenant ownership and get member context
    const { authority, memberId: actorMemberId } = await verifyTenantOwnership(job.companyId);

    // Validate that actorMemberId exists (not a cross-tenant leak)
    if (!actorMemberId) {
      return apiError("NO_MEMBERSHIP", "Actor has no membership in this company", null, 403);
    }

    const assigneeId = assigneeType === AssigneeType.PERSON ? memberId : externalPartyId;

    if (!assigneeId) {
      return apiError("INVALID_ASSIGNEE", "Assignee ID missing", null, 400);
    }

    const assignment = await assignJobSlot({
      jobId,
      slotKey,
      assigneeType: assigneeType as AssigneeType,
      assigneeId,
      assignedByMemberId: actorMemberId,
    });

    return apiSuccess({ assignment }, 200, authority);
  } catch (error) {
    // If our helper threw a validation error, it's a 400
    if (error instanceof Error && error.message.includes("not belong to company")) {
      return apiError("TENANT_MISMATCH", error.message, null, 400);
    }
    return tenantErrorResponse(error);
  }
}
