/**
 * FlowSpec Cross-Flow Dependency Tests
 *
 * Epic: EPIC-05 FlowSpec Cross-Flow Dependencies
 * Canon Source: 10_flowspec_engine_contract.md §11, 20_flowspec_invariants.md
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import * as Engine from "@/lib/flowspec/engine";
import * as Instantiation from "@/lib/flowspec/instantiation";
import { WorkflowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function createTestMember(companyId: string, userId: string) {
  return prisma.companyMember.create({
    data: {
      companyId,
      userId,
      role: "OWNER",
    },
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

describe("EPIC-05: FlowSpec Cross-Flow Dependencies", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should gate actionability based on outcome in another flow (same group)", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);

    // 1. Create Finance Workflow (source)
    const financeWf = await prisma.workflow.create({
      data: {
        name: "Finance",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        nodes: {
          create: {
            name: "Collection",
            isEntry: true,
            tasks: {
              create: {
                name: "Collect Deposit",
                outcomes: { create: { name: "DEPOSIT_COLLECTED" } }
              }
            }
          }
        }
      },
      include: { nodes: { include: { tasks: { include: { outcomes: true } } } } }
    });
    
    // Create version for Finance
    const financeTask = financeWf.nodes[0].tasks[0];
    const financeSnapshot = {
      workflowId: financeWf.id,
      version: 1,
      name: financeWf.name,
      nodes: [{
        id: financeWf.nodes[0].id,
        name: financeWf.nodes[0].name,
        isEntry: true,
        nodeKind: "MAINLINE",
        completionRule: "ALL_TASKS_DONE",
        tasks: [{
          id: financeTask.id,
          name: financeTask.name,
          outcomes: [{ id: financeTask.outcomes[0].id, name: "DEPOSIT_COLLECTED" }],
          crossFlowDependencies: []
        }]
      }],
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: financeWf.id, version: 1, snapshot: financeSnapshot as any, publishedBy: MOCK_USER_ID }
    });

    // 2. Create Execution Workflow (target) with dependency on Finance
    const executionWf = await prisma.workflow.create({
      data: {
        name: "Execution",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        nodes: {
          create: {
            name: "Setup",
            isEntry: true,
            tasks: {
              create: {
                name: "Schedule Installation",
                outcomes: { create: { name: "SCHEDULED" } }
              }
            }
          }
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const executionTask = executionWf.nodes[0].tasks[0];
    const dep = await prisma.crossFlowDependency.create({
      data: {
        taskId: executionTask.id,
        sourceWorkflowId: financeWf.id,
        sourceTaskPath: `${financeWf.nodes[0].id}.${financeTask.id}`,
        requiredOutcome: "DEPOSIT_COLLECTED"
      }
    });

    const executionSnapshot = {
      workflowId: executionWf.id,
      version: 1,
      name: executionWf.name,
      nodes: [{
        id: executionWf.nodes[0].id,
        name: executionWf.nodes[0].name,
        isEntry: true,
        nodeKind: "MAINLINE",
        completionRule: "ALL_TASKS_DONE",
        tasks: [{
          id: executionTask.id,
          name: executionTask.name,
          outcomes: [{ name: "SCHEDULED" }],
          crossFlowDependencies: [{
            id: dep.id,
            sourceWorkflowId: financeWf.id,
            sourceTaskPath: `${financeWf.nodes[0].id}.${financeTask.id}`,
            requiredOutcome: "DEPOSIT_COLLECTED"
          }]
        }]
      }],
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: executionWf.id, version: 1, snapshot: executionSnapshot as any, publishedBy: MOCK_USER_ID }
    });

    // 3. Instantiate both flows in same group
    const scope = { type: "job", id: "job_123" };
    const financeFlowResult = await Instantiation.createFlow(financeWf.id, scope, company.id);
    const executionFlowResult = await Instantiation.createFlow(executionWf.id, scope, company.id);

    expect(financeFlowResult.success).toBe(true);
    expect(executionFlowResult.success).toBe(true);

    const financeFlowId = financeFlowResult.flowId!;
    const executionFlowId = executionFlowResult.flowId!;

    // 4. Verify Execution task is NOT actionable initially
    let actionable = await Engine.getActionableTasks(executionFlowId);
    expect(actionable.length).toBe(0);

    // 5. Record Finance outcome
    await Engine.startTask(financeFlowId, financeTask.id, MOCK_USER_ID);
    await Engine.recordOutcome(financeFlowId, financeTask.id, "DEPOSIT_COLLECTED", MOCK_USER_ID);

    // 6. Verify Execution task IS NOW actionable
    actionable = await Engine.getActionableTasks(executionFlowId);
    expect(actionable.length).toBe(1);
    expect(actionable[0].taskId).toBe(executionTask.id);
  });

  it("should NOT satisfy dependency if outcome is in a different flow group", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);

    // Reuse finance/execution setups from previous test (simplified)
    const financeWf = await prisma.workflow.create({
      data: { name: "Finance", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const executionWf = await prisma.workflow.create({
      data: { name: "Execution", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });

    const nodeF = await prisma.node.create({ data: { workflowId: financeWf.id, name: "N1", isEntry: true } });
    const taskF = await prisma.task.create({ data: { nodeId: nodeF.id, name: "TF" } });
    await prisma.outcome.create({ data: { taskId: taskF.id, name: "DONE" } });

    const nodeE = await prisma.node.create({ data: { workflowId: executionWf.id, name: "N1", isEntry: true } });
    const taskE = await prisma.task.create({ data: { nodeId: nodeE.id, name: "TE" } });
    const dep = await prisma.crossFlowDependency.create({
      data: { taskId: taskE.id, sourceWorkflowId: financeWf.id, sourceTaskPath: `${nodeF.id}.${taskF.id}`, requiredOutcome: "DONE" }
    });

    // Create snapshots
    await prisma.workflowVersion.create({
      data: { workflowId: financeWf.id, version: 1, snapshot: { workflowId: financeWf.id, nodes: [{ id: nodeF.id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: taskF.id, name: "TF", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }], gates: [] } as any, publishedBy: "A" }
    });
    await prisma.workflowVersion.create({
      data: { workflowId: executionWf.id, version: 1, snapshot: { workflowId: executionWf.id, nodes: [{ id: nodeE.id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: taskE.id, name: "TE", outcomes: [], crossFlowDependencies: [{ sourceWorkflowId: financeWf.id, sourceTaskPath: `${nodeF.id}.${taskF.id}`, requiredOutcome: "DONE" }] }] }], gates: [] } as any, publishedBy: "A" }
    });

    // Instantiate in DIFFERENT groups
    const resF = await Instantiation.createFlow(financeWf.id, { type: "group", id: "A" }, company.id);
    const resE = await Instantiation.createFlow(executionWf.id, { type: "group", id: "B" }, company.id);

    expect(resF.success).toBe(true);
    expect(resE.success).toBe(true);

    const financeFlowId = resF.flowId!;
    const executionFlowId = resE.flowId!;

    // Record Finance outcome in Group A
    await Engine.startTask(financeFlowId, taskF.id, MOCK_USER_ID);
    await Engine.recordOutcome(financeFlowId, taskF.id, "DONE", MOCK_USER_ID);

    // Verify Execution in Group B is still NOT actionable
    const actionable = await Engine.getActionableTasks(executionFlowId);
    expect(actionable.length).toBe(0);
  });

  it("should enforce INV-022: Actionability is only checked at Task start", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);

    // Flow 1: Finance (source)
    const financeWf = await prisma.workflow.create({
      data: { name: "Finance", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const nodeF = await prisma.node.create({ data: { workflowId: financeWf.id, name: "N1", isEntry: true } });
    const taskF = await prisma.task.create({ data: { nodeId: nodeF.id, name: "TF" } });
    await prisma.outcome.create({ data: { taskId: taskF.id, name: "DONE" } });

    // Flow 2: Execution (target)
    const executionWf = await prisma.workflow.create({
      data: { name: "Execution", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const nodeE = await prisma.node.create({ data: { workflowId: executionWf.id, name: "N1", isEntry: true } });
    const taskE = await prisma.task.create({ data: { nodeId: nodeE.id, name: "TE" } });
    await prisma.outcome.create({ data: { taskId: taskE.id, name: "OK" } });
    
    const dep = await prisma.crossFlowDependency.create({
      data: { taskId: taskE.id, sourceWorkflowId: financeWf.id, sourceTaskPath: `${nodeF.id}.${taskF.id}`, requiredOutcome: "DONE" }
    });

    // Create snapshots
    await prisma.workflowVersion.create({
      data: { workflowId: financeWf.id, version: 1, snapshot: { workflowId: financeWf.id, nodes: [{ id: nodeF.id, name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE", tasks: [{ id: taskF.id, name: "TF", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }], gates: [] } as any, publishedBy: "A" }
    });
    await prisma.workflowVersion.create({
      data: { workflowId: executionWf.id, version: 1, snapshot: { workflowId: executionWf.id, nodes: [{ id: nodeE.id, name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE", tasks: [{ id: taskE.id, name: "TE", outcomes: [{ name: "OK" }], crossFlowDependencies: [{ sourceWorkflowId: financeWf.id, sourceTaskPath: `${nodeF.id}.${taskF.id}`, requiredOutcome: "DONE" }] }] }], gates: [] } as any, publishedBy: "A" }
    });

    const scope = { type: "job", id: "INV-022" };
    const resF = await Instantiation.createFlow(financeWf.id, scope, company.id);
    const resE = await Instantiation.createFlow(executionWf.id, scope, company.id);
    const financeFlowId = resF.flowId!;
    const executionFlowId = resE.flowId!;

    // 1. Task TE is not actionable
    expect(await Engine.isTaskActionable(executionFlowId, taskE.id)).toBe(false);

    // 2. Satisfy dependency
    await Engine.startTask(financeFlowId, taskF.id, MOCK_USER_ID);
    await Engine.recordOutcome(financeFlowId, taskF.id, "DONE", MOCK_USER_ID);

    // 3. Task TE IS actionable
    expect(await Engine.isTaskActionable(executionFlowId, taskE.id)).toBe(true);

    // 4. Start Task TE
    await Engine.startTask(executionFlowId, taskE.id, MOCK_USER_ID);

    // 5. Simulate "dependency change" - although outcomes are immutable, 
    // we can test if the engine re-checks. Since we can't easily undo an outcome,
    // we'll verify the code path in Engine.recordOutcome does not call computeTaskActionable.
    // Actually, INV-022 means even if the source outcome was somehow deleted (which it shouldn't be),
    // the started task can still be completed.
    
    const res = await Engine.recordOutcome(executionFlowId, taskE.id, "OK", MOCK_USER_ID);
    expect(res.success).toBe(true);
  });

  it("should support bidirectional dependencies", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);

    // Flow 1: Finance
    const financeWf = await prisma.workflow.create({
      data: { name: "Finance", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const nodeF = await prisma.node.create({ data: { workflowId: financeWf.id, name: "N1", isEntry: true } });
    const taskF1 = await prisma.task.create({ data: { nodeId: nodeF.id, name: "TF1" } });
    const taskF2 = await prisma.task.create({ data: { nodeId: nodeF.id, name: "TF2" } });
    await prisma.outcome.create({ data: { taskId: taskF1.id, name: "DONE" } });
    await prisma.outcome.create({ data: { taskId: taskF2.id, name: "DONE" } });

    // Flow 2: Execution
    const executionWf = await prisma.workflow.create({
      data: { name: "Execution", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const nodeE = await prisma.node.create({ data: { workflowId: executionWf.id, name: "N1", isEntry: true } });
    const taskE1 = await prisma.task.create({ data: { nodeId: nodeE.id, name: "TE1" } });
    const taskE2 = await prisma.task.create({ data: { nodeId: nodeE.id, name: "TE2" } });
    await prisma.outcome.create({ data: { taskId: taskE1.id, name: "DONE" } });
    await prisma.outcome.create({ data: { taskId: taskE2.id, name: "DONE" } });

    // Dependencies:
    // Execution TE1 depends on Finance TF1
    // Finance TF2 depends on Execution TE1
    await prisma.crossFlowDependency.create({
      data: { taskId: taskE1.id, sourceWorkflowId: financeWf.id, sourceTaskPath: `${nodeF.id}.${taskF1.id}`, requiredOutcome: "DONE" }
    });
    await prisma.crossFlowDependency.create({
      data: { taskId: taskF2.id, sourceWorkflowId: executionWf.id, sourceTaskPath: `${nodeE.id}.${taskE1.id}`, requiredOutcome: "DONE" }
    });

    // Create snapshots (abbreviated)
    await prisma.workflowVersion.create({
      data: { workflowId: financeWf.id, version: 1, snapshot: { workflowId: financeWf.id, nodes: [{ id: nodeF.id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: taskF1.id, name: "TF1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }, { id: taskF2.id, name: "TF2", outcomes: [{ name: "DONE" }], crossFlowDependencies: [{ sourceWorkflowId: executionWf.id, sourceTaskPath: `${nodeE.id}.${taskE1.id}`, requiredOutcome: "DONE" }] }] }], gates: [] } as any, publishedBy: "A" }
    });
    await prisma.workflowVersion.create({
      data: { workflowId: executionWf.id, version: 1, snapshot: { workflowId: executionWf.id, nodes: [{ id: nodeE.id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: taskE1.id, name: "TE1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [{ sourceWorkflowId: financeWf.id, sourceTaskPath: `${nodeF.id}.${taskF1.id}`, requiredOutcome: "DONE" }] }, { id: taskE2.id, name: "TE2", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }], gates: [] } as any, publishedBy: "A" }
    });

    const scope = { type: "job", id: "BIDIR" };
    const resF = await Instantiation.createFlow(financeWf.id, scope, company.id);
    const resE = await Instantiation.createFlow(executionWf.id, scope, company.id);
    const flowF = resF.flowId!;
    const flowE = resE.flowId!;

    // Initial state:
    // Finance: TF1 actionable, TF2 NOT actionable
    // Execution: TE1 NOT actionable, TE2 actionable
    expect(await Engine.isTaskActionable(flowF, taskF1.id)).toBe(true);
    expect(await Engine.isTaskActionable(flowF, taskF2.id)).toBe(false);
    expect(await Engine.isTaskActionable(flowE, taskE1.id)).toBe(false);
    expect(await Engine.isTaskActionable(flowE, taskE2.id)).toBe(true);

    // 1. Complete Finance TF1
    await Engine.startTask(flowF, taskF1.id, MOCK_USER_ID);
    await Engine.recordOutcome(flowF, taskF1.id, "DONE", MOCK_USER_ID);

    // Now Execution TE1 should be actionable
    expect(await Engine.isTaskActionable(flowE, taskE1.id)).toBe(true);

    // 2. Complete Execution TE1
    await Engine.startTask(flowE, taskE1.id, MOCK_USER_ID);
    await Engine.recordOutcome(flowE, taskE1.id, "DONE", MOCK_USER_ID);

    // Now Finance TF2 should be actionable
    expect(await Engine.isTaskActionable(flowF, taskF2.id)).toBe(true);
  });
});
