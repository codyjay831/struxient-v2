import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOutcome } from "@/lib/flowspec/engine";
import * as fanout from "@/lib/flowspec/instantiation/fanout";
import { CompletionRule, WorkflowStatus, FlowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.job.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Item 3: Fan-Out Failure Resilience", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should mark flow as BLOCKED when executeFanOut fails", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Fanout Failure Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
      },
    });

    const node = await prisma.node.create({ data: { workflowId: workflow.id, name: "N1", isEntry: true } });
    const task = await prisma.task.create({ data: { nodeId: node.id, name: "T1" } });
    await prisma.outcome.create({ data: { taskId: task.id, name: "DONE" } });

    const snapshot: any = {
      nodes: [{ id: node.id, name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE", tasks: [{ id: task.id, name: "T1", outcomes: [{ name: "DONE" }] }] }],
      gates: []
    };

    const workflowVersion = await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
    });

    const flowGroup = await prisma.flowGroup.create({
      data: { scopeType: "test", scopeId: "test-fanout", companyId: company.id }
    });

    const flow = await prisma.flow.create({
      data: {
        workflow: { connect: { id: workflow.id } },
        workflowVersion: { connect: { id: workflowVersion.id } },
        flowGroup: { connect: { id: flowGroup.id } },
        status: FlowStatus.ACTIVE
      }
    });

    await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: node.id, iteration: 1 } });
    await prisma.taskExecution.create({ data: { flowId: flow.id, taskId: task.id, startedAt: new Date(), startedBy: "u1", iteration: 1 } });

    // Mock executeFanOut to fail
    const fanoutSpy = vi.spyOn(fanout, "executeFanOut").mockRejectedValue(new Error("Fanout Error"));

    const result = await recordOutcome(flow.id, task.id, "DONE", "user-1");

    // Outcome should still succeed
    expect(result.success).toBe(true);
    expect(fanoutSpy).toHaveBeenCalled();

    // Flow should be BLOCKED
    const updatedFlow = await prisma.flow.findUnique({ where: { id: flow.id } });
    expect(updatedFlow?.status).toBe(FlowStatus.BLOCKED);

    // Truth record should exist
    const execution = await prisma.taskExecution.findFirst({ where: { flowId: flow.id, taskId: task.id } });
    expect(execution?.outcome).toBe("DONE");
  });
});
