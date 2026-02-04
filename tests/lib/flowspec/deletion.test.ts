/**
 * FlowSpec Workflow Deletion Tests
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.1
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteWorkflow } from "@/lib/flowspec/persistence/workflow";
import { WorkflowStatus } from "@prisma/client";
import { buildAuthorityContext } from "@/lib/auth/capabilities";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.taskPolicyOverride.deleteMany({});
  await prisma.flowGroupPolicy.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.detourRecord.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.fanOutFailure.deleteMany({});
  await prisma.fanOutRule.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.gate.deleteMany({});
  await prisma.crossFlowDependency.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("FlowSpec Workflow Deletion Enforcement", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should successfully delete a DRAFT workflow with no versions", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Draft Workflow",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    const tenantCtx = {
      companyId: company.id,
      userId: "test-user",
      memberId: "test-member",
      authority: buildAuthorityContext({ role: "OWNER" } as any),
    };

    await expect(deleteWorkflow(workflow.id, tenantCtx)).resolves.not.toThrow();
    
    const deleted = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(deleted).toBeNull();
  });

  it("should fail to delete a PUBLISHED workflow", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Published Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
      },
    });

    const tenantCtx = {
      companyId: company.id,
      userId: "test-user",
      memberId: "test-member",
      authority: buildAuthorityContext({ role: "OWNER" } as any),
    };

    try {
      await deleteWorkflow(workflow.id, tenantCtx);
      expect.fail("Should have thrown PUBLISHED_IMMUTABLE");
    } catch (err: any) {
      expect(err.code).toBe("PUBLISHED_IMMUTABLE");
      expect(err.message).toContain("Published workflows cannot be deleted");
    }

    const stillExists = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(stillExists).not.toBeNull();
  });

  it("should fail to delete a DRAFT workflow that has published versions", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Draft with Versions",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
        versions: {
          create: [
            { version: 1, snapshot: {}, publishedBy: "test-user" }
          ]
        }
      },
    });

    const tenantCtx = {
      companyId: company.id,
      userId: "test-user",
      memberId: "test-member",
      authority: buildAuthorityContext({ role: "OWNER" } as any),
    };

    try {
      await deleteWorkflow(workflow.id, tenantCtx);
      expect.fail("Should have thrown PUBLISHED_IMMUTABLE");
    } catch (err: any) {
      expect(err.code).toBe("PUBLISHED_IMMUTABLE");
      expect(err.message).toContain("Published workflows cannot be deleted");
    }

    const stillExists = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(stillExists).not.toBeNull();
  });
});
