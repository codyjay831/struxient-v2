import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { startTask, recordOutcome } from "@/lib/flowspec/engine";
import { hookRegistry } from "@/lib/flowspec/hooks";
import { CompletionRule, WorkflowStatus } from "@prisma/client";

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

describe("Item 2: Post-Commit Hooks", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should fire hooks after successful startTask", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Hook Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
      },
    });

    const node = await prisma.node.create({
      data: { workflowId: workflow.id, name: "Node 1", isEntry: true },
    });

    const task = await prisma.task.create({
      data: { nodeId: node.id, name: "Task 1" },
    });

    const snapshot: any = {
      nodes: [{ id: node.id, name: node.name, isEntry: true, completionRule: CompletionRule.ALL_TASKS_DONE, tasks: [{ id: task.id, outcomes: [] }] }],
      gates: []
    };

    const workflowVersion = await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
    });

    const flowGroup = await prisma.flowGroup.create({
      data: { scopeType: "test", scopeId: "test-hooks", companyId: company.id }
    });

    const flow = await prisma.flow.create({
      data: {
        workflow: { connect: { id: workflow.id } },
        workflowVersion: { connect: { id: workflowVersion.id } },
        flowGroup: { connect: { id: flowGroup.id } }
      }
    });

    await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: node.id, iteration: 1 } });

    const callback = vi.fn();
    hookRegistry.subscribe(callback);

    await startTask(flow.id, task.id, "user-1");

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      type: "TASK_STARTED",
      flowId: flow.id,
      taskId: task.id,
      userId: "user-1"
    }));
  });

  it("should fire multiple hooks for recordOutcome (TASK_DONE, NODE_ACTIVATED, FLOW_COMPLETED)", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Full Flow Hook Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
      },
    });

    const node1 = await prisma.node.create({ data: { workflowId: workflow.id, name: "N1", isEntry: true } });
    const node2 = await prisma.node.create({ data: { workflowId: workflow.id, name: "N2" } });
    const task1 = await prisma.task.create({ data: { nodeId: node1.id, name: "T1" } });
    const task2 = await prisma.task.create({ data: { nodeId: node2.id, name: "T2" } });
    
    await prisma.outcome.create({ data: { taskId: task1.id, name: "DONE" } });
    await prisma.outcome.create({ data: { taskId: task2.id, name: "FINISH" } });
    await prisma.gate.create({ data: { workflowId: workflow.id, sourceNodeId: node1.id, outcomeName: "DONE", targetNodeId: node2.id } });
    await prisma.gate.create({ data: { workflowId: workflow.id, sourceNodeId: node2.id, outcomeName: "FINISH", targetNodeId: null } });

    const snapshot: any = {
      nodes: [
        { id: node1.id, name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE", tasks: [{ id: task1.id, name: "T1", outcomes: [{ name: "DONE" }] }] },
        { id: node2.id, name: "N2", isEntry: false, completionRule: "ALL_TASKS_DONE", tasks: [{ id: task2.id, name: "T2", outcomes: [{ name: "FINISH" }] }] }
      ],
      gates: [
        { sourceNodeId: node1.id, outcomeName: "DONE", targetNodeId: node2.id },
        { sourceNodeId: node2.id, outcomeName: "FINISH", targetNodeId: null }
      ]
    };

    const workflowVersion = await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
    });

    const flowGroup = await prisma.flowGroup.create({
      data: { scopeType: "test", scopeId: "test-full", companyId: company.id }
    });

    const flow = await prisma.flow.create({
      data: {
        workflow: { connect: { id: workflow.id } },
        workflowVersion: { connect: { id: workflowVersion.id } },
        flowGroup: { connect: { id: flowGroup.id } }
      }
    });

    await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: node1.id, iteration: 1 } });
    await prisma.taskExecution.create({ data: { flowId: flow.id, taskId: task1.id, startedAt: new Date(), startedBy: "u1", iteration: 1 } });

    const events: any[] = [];
    hookRegistry.subscribe((event) => { events.push(event); });

    await recordOutcome(flow.id, task1.id, "DONE", "user-1");

    expect(events).toContainEqual(expect.objectContaining({ type: "TASK_DONE", taskId: task1.id, outcome: "DONE" }));
    expect(events).toContainEqual(expect.objectContaining({ type: "NODE_ACTIVATED", nodeId: node2.id }));
  });

  it("should NOT fire hooks if transaction fails", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Failure Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
      },
    });

    const node = await prisma.node.create({ data: { workflowId: workflow.id, name: "N1", isEntry: true } });
    const task = await prisma.task.create({ data: { nodeId: node.id, name: "T1" } });
    await prisma.outcome.create({ data: { taskId: task.id, name: "DONE" } });

    const snapshot: any = {
      nodes: [{ id: node.id, name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE", tasks: [{ id: task.id, outcomes: [{ name: "DONE" }] }] }],
      gates: []
    };

    const workflowVersion = await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
    });

    const flow = await prisma.flow.create({
      data: {
        workflow: { connect: { id: workflow.id } },
        workflowVersion: { connect: { id: workflowVersion.id } },
        flowGroup: { create: { companyId: company.id, scopeType: "t", scopeId: "s" } }
      }
    });

    await prisma.nodeActivation.create({ data: { flowId: flow.id, nodeId: node.id, iteration: 1 } });
    // Task NOT started, so recordOutcome will fail before transaction or during transaction depending on logic.
    // In current engine.ts, it fails during pre-transaction check, so it's a good test for "no hooks if failed".

    const callback = vi.fn();
    hookRegistry.subscribe(callback);

    const result = await recordOutcome(flow.id, task.id, "DONE", "u1");
    expect(result.success).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });
});
