/**
 * FlowSpec Workflow Lifecycle Tests
 *
 * Epic: EPIC-04 FlowSpec Workflow Lifecycle
 * Canon Source: 10_flowspec_engine_contract.md §7
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  validateWorkflowAction,
  publishWorkflowAction,
  revertToDraftAction,
  branchFromVersion,
} from "@/lib/flowspec/lifecycle";
import { WorkflowStatus, CompletionRule } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.detourRecord.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.job.deleteMany({});
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

async function createValidDraftWorkflow(companyId: string) {
  const workflow = await prisma.workflow.create({
    data: {
      name: "Valid Draft",
      companyId,
      status: WorkflowStatus.DRAFT,
    },
  });

  const node = await prisma.node.create({
    data: {
      workflowId: workflow.id,
      name: "Entry Node",
      isEntry: true,
    },
  });

  const task = await prisma.task.create({
    data: {
      nodeId: node.id,
      name: "Task 1",
    },
  });

  await prisma.outcome.create({
    data: {
      taskId: task.id,
      name: "DONE",
    },
  });

  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: node.id,
      outcomeName: "DONE",
      targetNodeId: null,
    },
  });

  return workflow;
}

describe("EPIC-04: FlowSpec Workflow Lifecycle", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should transition from DRAFT to VALIDATED if validation passes", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);

    const result = await validateWorkflowAction(workflow.id);
    expect(result.success).toBe(true);
    expect(result.to).toBe(WorkflowStatus.VALIDATED);

    const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe(WorkflowStatus.VALIDATED);
  });

  it("should fail transition to VALIDATED if validation fails", async () => {
    const company = await createTestCompany();
    // Create workflow with no entry node
    const workflow = await prisma.workflow.create({
      data: {
        name: "Invalid Draft",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    const result = await validateWorkflowAction(workflow.id);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_FAILED");
    expect(result.validation?.errors.some(e => e.code === "NO_ENTRY_NODE")).toBe(true);

    const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe(WorkflowStatus.DRAFT);
  });

  it("should transition from VALIDATED to DRAFT via Edit action", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);
    await validateWorkflowAction(workflow.id);

    const result = await revertToDraftAction(workflow.id);
    expect(result.success).toBe(true);
    expect(result.to).toBe(WorkflowStatus.DRAFT);

    const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe(WorkflowStatus.DRAFT);
  });

  it("should block revert to DRAFT if already in DRAFT state", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);
    // workflow is in DRAFT

    const result = await revertToDraftAction(workflow.id);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_STATE");
    expect(result.error?.message).toContain("Only Validated workflows can be reverted");
  });

  it("should block revert to DRAFT if workflow is PUBLISHED", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);
    await validateWorkflowAction(workflow.id);
    await publishWorkflowAction(workflow.id, "test-user");

    const result = await revertToDraftAction(workflow.id);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_STATE");
    
    // Verify workflow remains PUBLISHED
    const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe(WorkflowStatus.PUBLISHED);
  });

  it("should transition from VALIDATED to PUBLISHED and create a version", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);
    await validateWorkflowAction(workflow.id);

    const result = await publishWorkflowAction(workflow.id, "test-user");
    expect(result.success).toBe(true);
    expect(result.to).toBe(WorkflowStatus.PUBLISHED);
    expect(result.versionId).toBeDefined();

    const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    expect(updated?.status).toBe(WorkflowStatus.PUBLISHED);
    expect(updated?.publishedAt).not.toBeNull();

    const version = await prisma.workflowVersion.findUnique({
      where: { id: result.versionId }
    });
    expect(version).not.toBeNull();
    expect(version?.snapshot).toBeDefined();
    expect((version?.snapshot as any).workflowId).toBe(workflow.id);
  });

  it("should block transition to PUBLISHED if not in VALIDATED state", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);
    // workflow is in DRAFT

    const result = await publishWorkflowAction(workflow.id, "test-user");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_STATE");
  });

  it("should create a new Draft by branching from a Published version", async () => {
    const company = await createTestCompany();
    const workflow = await createValidDraftWorkflow(company.id);
    await validateWorkflowAction(workflow.id);
    const pubResult = await publishWorkflowAction(workflow.id, "test-user");

    const branchResult = await branchFromVersion(workflow.id, pubResult.version!, company.id, "test-user");
    expect(branchResult.success).toBe(true);
    expect(branchResult.to).toBe(WorkflowStatus.DRAFT);
    expect(branchResult.workflow?.id).not.toBe(workflow.id);
    expect(branchResult.workflow?.name).toBe(workflow.name);
    expect(branchResult.workflow?.version).toBe(workflow.version + 1);

    // Verify nodes and tasks were cloned
    expect(branchResult.workflow?.nodes.length).toBe(1);
    expect(branchResult.workflow?.nodes[0].tasks.length).toBe(1);
    expect(branchResult.workflow?.gates.length).toBe(1);
  });

  describe("INV-025 Lifecycle Enforcement", () => {
    it("should fail validate action if evidenceRequired is true but schema is missing", async () => {
      const company = await createTestCompany();
      const workflow = await createValidDraftWorkflow(company.id);
      
      // Add a task that requires evidence but has no schema
      const node = await prisma.node.findFirst({ where: { workflowId: workflow.id } });
      await prisma.task.create({
        data: {
          nodeId: node!.id,
          name: "Evidence Task",
          evidenceRequired: true,
          evidenceSchema: null as any,
        }
      });

      const result = await validateWorkflowAction(workflow.id);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_FAILED");
      expect(result.validation?.errors.some(e => e.code === "MISSING_EVIDENCE_SCHEMA")).toBe(true);
      
      const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
      expect(updated?.status).toBe(WorkflowStatus.DRAFT);
    });

    it("should block publish if a Validated workflow somehow misses a schema (revalidation)", async () => {
      const company = await createTestCompany();
      const workflow = await createValidDraftWorkflow(company.id);
      
      // 1. Manually force VALIDATED state despite missing schema
      // (Bypassing validationAction to simulate data corruption or direct DB edit)
      const node = await prisma.node.findFirst({ where: { workflowId: workflow.id } });
      await prisma.task.create({
        data: {
          nodeId: node!.id,
          name: "Evidence Task",
          evidenceRequired: true,
          evidenceSchema: null as any,
        }
      });
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { status: WorkflowStatus.VALIDATED }
      });

      // 2. Attempt publish - should re-validate and fail
      const result = await publishWorkflowAction(workflow.id, "test-user");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_FAILED");
      expect(result.validation?.errors.some(e => e.code === "MISSING_EVIDENCE_SCHEMA")).toBe(true);

      const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
      expect(updated?.status).toBe(WorkflowStatus.VALIDATED); // Remains Validated but not Published
    });
  });
});
