/**
 * FlowSpec Flow Instantiation Tests
 *
 * Epic: EPIC-03 FlowSpec Flow Instantiation
 * Canon Source: 10_flowspec_engine_contract.md §10
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createFlow } from "@/lib/flowspec/instantiation";
import { recordOutcome, startTask, isTaskActionable } from "@/lib/flowspec/engine";
import { WorkflowStatus, FlowStatus, CompletionRule } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
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

async function createPublishedWorkflow(companyId: string, name: string = "Test Workflow") {
  const workflow = await prisma.workflow.create({
    data: {
      name,
      companyId,
      status: WorkflowStatus.PUBLISHED,
      version: 1,
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

  const outcome = await prisma.outcome.create({
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

  const snapshot = {
    workflowId: workflow.id,
    version: 1,
    name: workflow.name,
    description: null,
    isNonTerminating: false,
    nodes: [{
      id: node.id,
      name: node.name,
      isEntry: true,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      tasks: [{
        id: task.id,
        name: task.name,
        instructions: null,
        evidenceRequired: false,
        evidenceSchema: null,
        displayOrder: 0,
        outcomes: [{ id: outcome.id, name: "DONE" }]
      }]
    }],
    gates: [{ id: "g1", sourceNodeId: node.id, outcomeName: "DONE", targetNodeId: null }]
  };

  await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      snapshot: snapshot as any,
      publishedBy: "test-user",
    },
  });

  return { workflow, node, task };
}

describe("EPIC-03: FlowSpec Flow Instantiation", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should create a Flow from a Published Workflow and bind to version", async () => {
    const company = await createTestCompany();
    const { workflow } = await createPublishedWorkflow(company.id);
    const scope = { type: "job", id: "job-1" };

    const result = await createFlow(workflow.id, scope, company.id);
    expect(result.success).toBe(true);
    expect(result.flowId).toBeDefined();
    expect(result.flowGroupId).toBeDefined();

    const flow = await prisma.flow.findUnique({
      where: { id: result.flowId },
      include: { workflowVersion: true, nodeActivations: true }
    });

    expect(flow?.workflowId).toBe(workflow.id);
    expect(flow?.workflowVersion.version).toBe(1);
    expect(flow?.nodeActivations.length).toBe(1);
    expect(flow?.nodeActivations[0].nodeId).toBeDefined();
  });

  it("should reject Flow creation from non-Published Workflow", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: { name: "Draft", companyId: company.id, status: WorkflowStatus.DRAFT }
    });
    const scope = { type: "job", id: "job-1" };

    const result = await createFlow(workflow.id, scope, company.id);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("WORKFLOW_NOT_PUBLISHED");
  });

  it("should enforce Scope -> Flow Group 1:1 relationship", async () => {
    const company = await createTestCompany();
    const { workflow } = await createPublishedWorkflow(company.id);
    const scope = { type: "job", id: "job-1" };

    const result1 = await createFlow(workflow.id, scope, company.id);
    const result2 = await createFlow(workflow.id, scope, company.id);

    expect(result1.flowGroupId).toBe(result2.flowGroupId);
  });

  it("should reject creation if flowGroupId hint mismatches Scope", async () => {
    const company = await createTestCompany();
    const { workflow } = await createPublishedWorkflow(company.id);
    const scope1 = { type: "job", id: "job-1" };
    const scope2 = { type: "job", id: "job-2" };

    const result1 = await createFlow(workflow.id, scope1, company.id);
    const result2 = await createFlow(workflow.id, scope2, company.id, result1.flowGroupId);

    expect(result2.success).toBe(false);
    expect(result2.error?.code).toBe("SCOPE_MISMATCH");
  });

  it("should execute fan-out rules on node completion", async () => {
    const company = await createTestCompany();
    
    // 1. Create target workflow
    const targetWfData = await createPublishedWorkflow(company.id, "Target Workflow");
    
    // 2. Create source workflow with fan-out rule
    const sourceWfData = await createPublishedWorkflow(company.id, "Source Workflow");
    await prisma.fanOutRule.create({
      data: {
        workflowId: sourceWfData.workflow.id,
        sourceNodeId: sourceWfData.node.id,
        triggerOutcome: "DONE",
        targetWorkflowId: targetWfData.workflow.id
      }
    });

    // 3. Instantiate source flow
    const scope = { type: "job", id: "job-fanout" };
    const createResult = await createFlow(sourceWfData.workflow.id, scope, company.id);
    
    // 4. Record outcome to trigger fan-out
    await startTask(createResult.flowId!, sourceWfData.task.id, "test-user");
    await recordOutcome(createResult.flowId!, sourceWfData.task.id, "DONE", "test-user");

    // 5. Verify target flow was created in same group
    const groupFlows = await prisma.flow.findMany({
      where: { flowGroupId: createResult.flowGroupId }
    });

    expect(groupFlows.length).toBe(2);
    expect(groupFlows.some(f => f.workflowId === targetWfData.workflow.id)).toBe(true);
  });

  it("should block parent flow if fan-out fails (INV-023)", async () => {
    const company = await createTestCompany();
    
    // 1. Create source workflow with fan-out rule to NON-EXISTENT target
    const sourceWfData = await createPublishedWorkflow(company.id, "Source Workflow");
    await prisma.fanOutRule.create({
      data: {
        workflowId: sourceWfData.workflow.id,
        sourceNodeId: sourceWfData.node.id,
        triggerOutcome: "DONE",
        targetWorkflowId: "non-existent-id"
      }
    });

    // 2. Instantiate source flow
    const scope = { type: "job", id: "job-fail" };
    const createResult = await createFlow(sourceWfData.workflow.id, scope, company.id);
    
    // 3. Record outcome
    await startTask(createResult.flowId!, sourceWfData.task.id, "test-user");
    await recordOutcome(createResult.flowId!, sourceWfData.task.id, "DONE", "test-user");

    // 4. Verify parent flow is BLOCKED but outcome remains recorded
    const flow = await prisma.flow.findUnique({ where: { id: createResult.flowId } });
    expect(flow?.status).toBe(FlowStatus.BLOCKED);

    const execution = await prisma.taskExecution.findFirst({
      where: { flowId: createResult.flowId!, taskId: sourceWfData.task.id }
    });
    expect(execution?.outcome).toBe("DONE");

    // 5. Verify failure was logged
    const failure = await prisma.fanOutFailure.findFirst({
      where: { triggeringFlowId: createResult.flowId }
    });
    expect(failure).not.toBeNull();
  });

  it("should not automatically mark Entry Node Tasks with Cross-Flow Dependencies as Actionable (INV-020)", async () => {
    const company = await createTestCompany();
    
    // 1. Create source workflow
    const sourceWf = await prisma.workflow.create({
      data: { name: "Source", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 }
    });

    // 2. Create target workflow with entry node task having dependency
    const workflow = await prisma.workflow.create({
      data: { name: "Dependent Wf", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 }
    });

    const node = await prisma.node.create({
      data: { workflowId: workflow.id, name: "Entry", isEntry: true }
    });

    const task = await prisma.task.create({
      data: { nodeId: node.id, name: "Dependent Task" }
    });

    await prisma.crossFlowDependency.create({
      data: {
        taskId: task.id,
        sourceWorkflowId: sourceWf.id,
        sourceTaskPath: "any",
        requiredOutcome: "DONE"
      }
    });

    const snapshot = {
      workflowId: workflow.id,
      version: 1,
      name: workflow.name,
      description: null,
      isNonTerminating: false,
      nodes: [{
        id: node.id,
        name: node.name,
        isEntry: true,
        completionRule: "ALL_TASKS_DONE",
        specificTasks: [],
        tasks: [{
          id: task.id,
          name: task.name,
          instructions: null,
          evidenceRequired: false,
          evidenceSchema: null,
          displayOrder: 0,
          outcomes: [],
          crossFlowDependencies: [{
            id: "dep-1",
            sourceWorkflowId: sourceWf.id,
            sourceTaskPath: "any",
            requiredOutcome: "DONE"
          }]
        }]
      }],
      gates: []
    };

    const wfVersion = await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" }
    });

    // 3. Create flow
    const scope = { type: "job", id: "job-dep" };
    const createResult = await createFlow(workflow.id, scope, company.id);

    // 4. Verify Task is NOT actionable even though flow started and node active
    const flowData = await prisma.flow.findUnique({
      where: { id: createResult.flowId },
      include: { nodeActivations: true }
    });
    expect(flowData?.nodeActivations.length).toBe(1);

    const isActionable = await isTaskActionable(createResult.flowId!, task.id);
    expect(isActionable).toBe(false);
  });
});
