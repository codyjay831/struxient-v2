import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  startTask,
  recordOutcome,
  activateEntryNodes,
  getFlow,
} from "@/lib/flowspec/engine";
import { MAX_NODE_ITERATIONS } from "@/lib/flowspec/constants";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import { CompletionRule, FlowStatus, WorkflowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Circuit Breaker Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

/**
 * Creates a workflow that loops back to itself.
 * Node A -> Outcome "LOOP" -> Node A
 */
async function createLoopingWorkflow(companyId: string) {
  const workflow = await prisma.workflow.create({
    data: {
      name: "Looping Workflow",
      companyId,
      status: WorkflowStatus.PUBLISHED,
      version: 1,
      publishedAt: new Date(),
    },
  });

  const node = await prisma.node.create({
    data: {
      workflowId: workflow.id,
      name: "Loop Node",
      isEntry: true,
      completionRule: CompletionRule.ALL_TASKS_DONE,
    },
  });

  const task = await prisma.task.create({
    data: {
      nodeId: node.id,
      name: "Loop Task",
    },
  });

  await prisma.outcome.create({
    data: {
      taskId: task.id,
      name: "LOOP",
    },
  });

  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: node.id,
      outcomeName: "LOOP",
      targetNodeId: node.id, // Self-loop
    },
  });

  const snapshot: WorkflowSnapshot = {
    workflowId: workflow.id,
    version: 1,
    name: workflow.name,
    description: null,
    isNonTerminating: false,
    nodes: [
      {
        id: node.id,
        name: node.name,
        isEntry: true,
        completionRule: CompletionRule.ALL_TASKS_DONE,
        specificTasks: [],
        tasks: [
          {
            id: task.id,
            name: task.name,
            instructions: null,
            evidenceRequired: false,
            evidenceSchema: null,
            displayOrder: 0,
            outcomes: [{ id: "o1", name: "LOOP" }],
            crossFlowDependencies: [],
          },
        ],
        transitiveSuccessors: [],
      },
    ],
    gates: [
      {
        id: "g1",
        sourceNodeId: node.id,
        outcomeName: "LOOP",
        targetNodeId: node.id,
      },
    ],
  };

  const workflowVersion = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      snapshot: snapshot as any,
      publishedBy: "test-user",
    },
  });

  return { workflow, node, task, workflowVersion, snapshot };
}

async function createTestFlow(workflowId: string, workflowVersionId: string, companyId: string) {
  const flowGroup = await prisma.flowGroup.create({
    data: {
      scopeType: "test",
      scopeId: `loop-test-${Date.now()}`,
      companyId,
    },
  });

  const flow = await prisma.flow.create({
    data: {
      workflowId,
      workflowVersionId,
      flowGroupId: flowGroup.id,
      status: FlowStatus.ACTIVE,
    },
  });

  return { flow };
}

async function cleanup() {
  await prisma.taskPolicyOverride.deleteMany({});
  await prisma.flowGroupPolicy.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.gate.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("FlowSpec Circuit Breaker (Guard A)", () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should mark flow as BLOCKED when iteration limit is exceeded", async () => {
    const company = await createTestCompany();
    const { workflow, task, workflowVersion, snapshot } = await createLoopingWorkflow(company.id);
    const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

    await activateEntryNodes(flow.id, snapshot);

    // Run up to the limit
    // We start at iteration 1.
    // Each recordOutcome with "LOOP" will trigger a new activation.
    // Iteration 2, 3, ..., MAX_NODE_ITERATIONS
    for (let i = 1; i < MAX_NODE_ITERATIONS; i++) {
      await startTask(flow.id, task.id, "test-user");
      const result = await recordOutcome(flow.id, task.id, "LOOP", "test-user");
      expect(result.success).toBe(true);
      
      const updatedFlow = await getFlow(flow.id);
      expect(updatedFlow?.status).toBe(FlowStatus.ACTIVE);
    }

    // This next outcome should trigger iteration MAX_NODE_ITERATIONS + 1
    await startTask(flow.id, task.id, "test-user");
    const finalResult = await recordOutcome(flow.id, task.id, "LOOP", "test-user");

    // recordOutcome should still report success: true because the outcome WAS recorded (Truth preserved)
    expect(finalResult.success).toBe(true);
    
    // But the flow status should now be BLOCKED
    const blockedFlow = await getFlow(flow.id);
    expect(blockedFlow?.status).toBe(FlowStatus.BLOCKED);

    // Verify Truth is preserved: We should have MAX_NODE_ITERATIONS outcomes
    const executions = await prisma.taskExecution.findMany({
      where: { flowId: flow.id },
    });
    expect(executions.filter(e => e.outcome === "LOOP").length).toBe(MAX_NODE_ITERATIONS);
  });

  it("should not block flow when below iteration limit", async () => {
    const company = await createTestCompany();
    const { workflow, task, workflowVersion, snapshot } = await createLoopingWorkflow(company.id);
    const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

    await activateEntryNodes(flow.id, snapshot);

    // Just do a few loops
    for (let i = 1; i <= 5; i++) {
      await startTask(flow.id, task.id, "test-user");
      await recordOutcome(flow.id, task.id, "LOOP", "test-user");
    }

    const activeFlow = await getFlow(flow.id);
    expect(activeFlow?.status).toBe(FlowStatus.ACTIVE);
  });
});
