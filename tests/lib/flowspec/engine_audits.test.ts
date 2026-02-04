import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  startTask,
  recordOutcome,
} from "@/lib/flowspec/engine";
import { WorkflowStatus, FlowStatus, CompletionRule, ValidityState } from "@prisma/client";

async function cleanupTestData() {
  await prisma.validityEvent.deleteMany({});
  await prisma.detourRecord.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroupPolicy.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.gate.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

async function setupAuditWorkflow() {
  const company = await prisma.company.create({ data: { name: "Audit" } });
  const workflow = await prisma.workflow.create({
    data: { name: "Audit", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 },
  });

  const n1 = await prisma.node.create({
    data: { workflowId: workflow.id, name: "Node 1", isEntry: true },
  });

  const t1 = await prisma.task.create({
    data: { nodeId: n1.id, name: "Task 1" },
  });
  await prisma.outcome.create({ data: { taskId: t1.id, name: "DONE" } });

  const snapshot = {
    workflowId: workflow.id,
    version: 1,
    name: "Audit",
    nodes: [
      { id: n1.id, name: "Node 1", isEntry: true, tasks: [{ id: t1.id, outcomes: [{ name: "DONE" }] }], transitiveSuccessors: [] },
    ],
    gates: [],
  };

  const version = await prisma.workflowVersion.create({
    data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
  });

  const flowGroup = await prisma.flowGroup.create({
    data: { companyId: company.id, scopeType: "audit", scopeId: "1" },
  });

  const flow = await prisma.flow.create({
    data: {
      workflowId: workflow.id,
      workflowVersionId: version.id,
      flowGroupId: flowGroup.id,
      status: FlowStatus.ACTIVE,
    },
  });

  await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: n1.id, iteration: 1 } });

  return { flow, n1, t1 };
}

describe("Engine Blast-Radius Audits", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("Audit A (CT-START-01): should refuse starting the same task twice if first is still open", async () => {
    const { flow, t1 } = await setupAuditWorkflow();
    
    // First start
    const result1 = await startTask(flow.id, t1.id, "user1");
    expect(result1.success).toBe(true);

    // Second start (retry/idempotency check)
    const result2 = await startTask(flow.id, t1.id, "user1");
    expect(result2.success).toBe(false);
    expect(result2.error?.code).toBe("TASK_ALREADY_STARTED");

    const count = await prisma.taskExecution.count({
      where: { flowId: flow.id, taskId: t1.id },
    });
    expect(count).toBe(1);
  });

  it("Audit B (T-OUTCOME-01): should pin outcome to correct execution when multiple exist across iterations", async () => {
    const { flow, t1 } = await setupAuditWorkflow();
    
    // 1. Record outcome for iteration 1
    await startTask(flow.id, t1.id, "user1");
    const res1 = await recordOutcome(flow.id, t1.id, "DONE", "user1");
    const te1 = res1.taskExecutionId;

    // 2. Activate iteration 2
    await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: t1.nodeId, iteration: 2 } });

    // 3. Start task for iteration 2
    const startRes = await startTask(flow.id, t1.id, "user1");
    const te2 = startRes.taskExecutionId;

    // 4. Record outcome WITHOUT taskExecutionId
    const res2 = await recordOutcome(flow.id, t1.id, "DONE", "user1");
    
    // Verify it pinned to te2 (the only active one)
    expect(res2.taskExecutionId).toBe(te2);
    expect(res2.taskExecutionId).not.toBe(te1);

    const checkTe1 = await prisma.taskExecution.findUnique({ where: { id: te1 } });
    const checkTe2 = await prisma.taskExecution.findUnique({ where: { id: te2 } });
    expect(checkTe1?.outcome).toBe("DONE");
    expect(checkTe2?.outcome).toBe("DONE");
  });

  it("Audit B (CT-OUTCOME-02): should refuse taskExecutionId from wrong iteration", async () => {
    const { flow, t1 } = await setupAuditWorkflow();
    
    // 1. Start task for iteration 1
    const startResult = await startTask(flow.id, t1.id, "user1");
    const te1 = startResult.taskExecutionId!;

    // 2. Manually advance flow to iteration 2
    await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: t1.nodeId, iteration: 2 } });

    // 3. Attempt to record outcome using te1 (which belongs to iteration 1)
    // The engine should detect the iteration mismatch (iteration 2 is active, but te1 is iteration 1)
    const result = await recordOutcome(flow.id, t1.id, "DONE", "user1", undefined);
    
    // This should fail because there's no active execution for iteration 2
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("TASK_NOT_STARTED");
    expect(result.error?.message).toContain("iteration 2");
  });
});
