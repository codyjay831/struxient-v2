import { prisma } from "@/lib/prisma";
import { AssigneeType } from "./constants";

/**
 * Assigns a person or external party to a Job Responsibility Slot.
 * 
 * Behavior:
 * 1. Sets all existing non-superseded assignments for this (jobId, slotKey) to supersededAt = now.
 * 2. Inserts the new JobAssignment.
 * 
 * Note: Tenancy checks must be performed by the caller before invoking this helper.
 * 
 * @param params - Assignment parameters
 * @returns The newly created JobAssignment
 */
export async function assignJobSlot(params: {
  jobId: string;
  slotKey: string;
  assigneeType: AssigneeType;
  assigneeId: string; // memberId if PERSON, externalPartyId if EXTERNAL
  assignedByMemberId: string;
}) {
  const { jobId, slotKey, assigneeType, assigneeId, assignedByMemberId } = params;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Load Job to get companyId for tenant validation
    const job = await tx.job.findUnique({
      where: { id: jobId },
      select: { companyId: true }
    });
    if (!job) throw new Error(`Job ${jobId} not found`);
    const companyId = job.companyId;

    // 2. Validate assignedByMemberId belongs to same company
    const assigner = await tx.companyMember.findUnique({
      where: { id: assignedByMemberId },
      select: { companyId: true }
    });
    if (!assigner || assigner.companyId !== companyId) {
      throw new Error(`Assigner ${assignedByMemberId} does not belong to company ${companyId}`);
    }

    // 3. Validate Assignee and Tenant Consistency
    let memberId: string | null = null;
    let externalPartyId: string | null = null;

    if (assigneeType === AssigneeType.PERSON) {
      const member = await tx.companyMember.findUnique({
        where: { id: assigneeId },
        select: { companyId: true }
      });
      if (!member || member.companyId !== companyId) {
        throw new Error(`Assignee PERSON ${assigneeId} does not belong to company ${companyId}`);
      }
      memberId = assigneeId;
    } else if (assigneeType === AssigneeType.EXTERNAL) {
      const externalParty = await tx.externalParty.findUnique({
        where: { id: assigneeId },
        select: { companyId: true }
      });
      if (!externalParty || externalParty.companyId !== companyId) {
        throw new Error(`Assignee EXTERNAL ${assigneeId} does not belong to company ${companyId}`);
      }
      externalPartyId = assigneeId;
    } else {
      throw new Error(`Invalid assigneeType: ${assigneeType}`);
    }

    // 4. Supersede existing assignments for this slot
    await tx.jobAssignment.updateMany({
      where: {
        jobId,
        slotKey,
        supersededAt: null,
      },
      data: {
        supersededAt: now,
      },
    });

    // 5. Insert new assignment
    return await tx.jobAssignment.create({
      data: {
        jobId,
        slotKey,
        assigneeType: assigneeType as any,
        memberId,
        externalPartyId,
        assignedByMemberId,
      },
    });
  });
}

/**
 * Retrieves the current (non-superseded) assignments for a Job.
 * 
 * @param jobId - The Job ID
 * @returns Array of current JobAssignments with assignee details
 */
export async function getCurrentJobAssignments(jobId: string) {
  return await prisma.jobAssignment.findMany({
    where: {
      jobId,
      supersededAt: null,
    },
    include: {
      member: true,
      externalParty: true,
    },
  });
}
