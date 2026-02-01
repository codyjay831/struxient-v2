import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { assignJobSlot } from "@/lib/responsibility/operations";
import { AssigneeType } from "@/lib/responsibility/constants";

describe("Responsibility Operations: assignJobSlot Validation", () => {
  let companyId: string;
  let jobId: string;
  let memberId: string;
  let externalPartyId: string;
  let otherCompanyId: string;
  let otherMemberId: string;

  beforeEach(async () => {
    // Cleanup in correct order
    await prisma.jobAssignment.deleteMany();
    await prisma.job.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.externalParty.deleteMany();
    await prisma.evidenceAttachment.deleteMany();
    await prisma.taskExecution.deleteMany();
    await prisma.nodeActivation.deleteMany();
    await prisma.fanOutFailure.deleteMany();
    await prisma.flow.deleteMany();
    await prisma.flowGroup.deleteMany();
    await prisma.workflowVersion.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.companyMember.deleteMany();
    await prisma.company.deleteMany();

    // Setup
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;

    const member = await prisma.companyMember.create({
      data: { companyId, userId: "user_1", role: "WORKER" }
    });
    memberId = member.id;

    const external = await prisma.externalParty.create({
      data: { companyId, name: "External 1" }
    });
    externalPartyId = external.id;

    const flowGroup = await prisma.flowGroup.create({
      data: { companyId, scopeType: "job", scopeId: "job_1" }
    });

    const customer = await prisma.customer.create({
      data: { companyId, name: "Customer 1" }
    });

    const job = await prisma.job.create({
      data: { companyId, customerId: customer.id, flowGroupId: flowGroup.id, address: "123 Main St" }
    });
    jobId = job.id;

    // Other company for cross-tenant tests
    const otherCompany = await prisma.company.create({ data: { name: "Other Co" } });
    otherCompanyId = otherCompany.id;
    const otherMember = await prisma.companyMember.create({
      data: { companyId: otherCompanyId, userId: "user_2", role: "WORKER" }
    });
    otherMemberId = otherMember.id;
  });

  it("PERSON assignment requires memberId and forbids externalPartyId (implicitly handled by assigneeId)", async () => {
    // This helper uses assigneeId which is mapped to the correct field.
    // We test that it fails if the assigneeId is actually an ExternalParty ID but type is PERSON.
    
    await expect(assignJobSlot({
      jobId,
      slotKey: "PM",
      assigneeType: AssigneeType.PERSON,
      assigneeId: externalPartyId, // Wrong ID for PERSON type
      assignedByMemberId: memberId
    })).rejects.toThrow(/Assignee PERSON .* does not belong to company/);
  });

  it("EXTERNAL assignment requires externalPartyId and forbids memberId", async () => {
    await expect(assignJobSlot({
      jobId,
      slotKey: "PM",
      assigneeType: AssigneeType.EXTERNAL,
      assigneeId: memberId, // Wrong ID for EXTERNAL type
      assignedByMemberId: memberId
    })).rejects.toThrow(/Assignee EXTERNAL .* does not belong to company/);
  });

  it("Cross-tenant: rejects if job and assigner are in different companies", async () => {
    await expect(assignJobSlot({
      jobId,
      slotKey: "PM",
      assigneeType: AssigneeType.PERSON,
      assigneeId: memberId,
      assignedByMemberId: otherMemberId // Cross-tenant!
    })).rejects.toThrow(/Assigner .* does not belong to company/);
  });

  it("Cross-tenant: rejects if assignee belongs to different company", async () => {
    await expect(assignJobSlot({
      jobId,
      slotKey: "PM",
      assigneeType: AssigneeType.PERSON,
      assigneeId: otherMemberId, // Cross-tenant!
      assignedByMemberId: memberId
    })).rejects.toThrow(/Assignee PERSON .* does not belong to company/);
  });

  it("Validates and creates assignment successfully", async () => {
    const assignment = await assignJobSlot({
      jobId,
      slotKey: "PM",
      assigneeType: AssigneeType.PERSON,
      assigneeId: memberId,
      assignedByMemberId: memberId
    });

    expect(assignment.memberId).toBe(memberId);
    expect(assignment.externalPartyId).toBeNull();
    expect(assignment.supersededAt).toBeNull();
  });
});
