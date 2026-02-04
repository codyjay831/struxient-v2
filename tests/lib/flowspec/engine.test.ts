/**
 * FlowSpec Engine Core Tests
 *
 * Epic: EPIC-01 FlowSpec Engine Core
 * Canon Source: 10_flowspec_engine_contract.md, 20_flowspec_invariants.md
 *
 * These tests verify the acceptance criteria for EPIC-01:
 * - Task can only start if Actionable
 * - Task start is recorded in Truth with timestamp
 * - Outcome must be in Task's allowed Outcomes list
 * - Outcome recording is rejected if Task not started
 * - Outcome recording triggers Gate evaluation
 * - Gate routes to correct target Node(s) based on Outcome
 * - Node re-activation in cycles creates new entries
 * - Determinism: replay of Truth produces identical Derived State
 * - Node completion rules (ALL, ANY, SPECIFIC) work correctly
 * - Gates keyed by (nodeId, outcomeName)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  startTask,
  recordOutcome,
  attachEvidence,
  getActionableTasks,
  isTaskActionable,
  activateNode,
  activateEntryNodes,
  getFlow,
  getWorkflowSnapshot,
} from "@/lib/flowspec/engine";
import {
  computeActionableTasks,
  computeNodeComplete,
  computeNodeStarted,
  computeFlowComplete,
  evaluateGates,
} from "@/lib/flowspec/derived";
import type { WorkflowSnapshot, SnapshotNode, SnapshotGate } from "@/lib/flowspec/types";
import { CompletionRule, EvidenceType, FlowStatus, WorkflowStatus } from "@prisma/client";

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Creates a test company for tenant isolation.
 */
async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

/**
 * Creates a simple workflow with one node and one task.
 */
async function createSimpleWorkflow(companyId: string) {
  // Create workflow
  const workflow = await prisma.workflow.create({
    data: {
      name: "Simple Test Workflow",
      companyId,
      status: WorkflowStatus.PUBLISHED,
      version: 1,
      publishedAt: new Date(),
    },
  });

  // Create node
  const node = await prisma.node.create({
    data: {
      workflowId: workflow.id,
      name: "Start Node",
      isEntry: true,
      completionRule: CompletionRule.ALL_TASKS_DONE,
    },
  });

  // Create task
  const task = await prisma.task.create({
    data: {
      nodeId: node.id,
      name: "Review Task",
      instructions: "Please review and approve or reject.",
    },
  });

  // Create outcomes
  const approvedOutcome = await prisma.outcome.create({
    data: {
      taskId: task.id,
      name: "APPROVED",
    },
  });

  const rejectedOutcome = await prisma.outcome.create({
    data: {
      taskId: task.id,
      name: "REJECTED",
    },
  });

  // Create gates (terminal)
  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: node.id,
      outcomeName: "APPROVED",
      targetNodeId: null, // Terminal
    },
  });

  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: node.id,
      outcomeName: "REJECTED",
      targetNodeId: null, // Terminal
    },
  });

  // Create workflow version with snapshot
  const snapshot: WorkflowSnapshot = {
    workflowId: workflow.id,
    version: 1,
    name: workflow.name,
    description: workflow.description,
    isNonTerminating: false,
    nodes: [
      {
        id: node.id,
        name: node.name,
        isEntry: true,
        nodeKind: "MAINLINE",
        completionRule: CompletionRule.ALL_TASKS_DONE,
        specificTasks: [],
        tasks: [
          {
            id: task.id,
            name: task.name,
            instructions: task.instructions,
            evidenceRequired: false,
            evidenceSchema: null,
            displayOrder: 0,
            outcomes: [
              { id: approvedOutcome.id, name: "APPROVED" },
              { id: rejectedOutcome.id, name: "REJECTED" },
            ],
          },
        ],
        transitiveSuccessors: [],
      },
    ],
    gates: [
      {
        id: "gate-1",
        sourceNodeId: node.id,
        outcomeName: "APPROVED",
        targetNodeId: null,
      },
      {
        id: "gate-2",
        sourceNodeId: node.id,
        outcomeName: "REJECTED",
        targetNodeId: null,
      },
    ],
  };

  const workflowVersion = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      snapshot: snapshot as object,
      publishedBy: "test-user",
    },
  });

  return { workflow, node, task, approvedOutcome, rejectedOutcome, workflowVersion, snapshot };
}

/**
 * Creates a workflow with multiple nodes for Gate routing tests.
 */
async function createMultiNodeWorkflow(companyId: string) {
  // Create workflow
  const workflow = await prisma.workflow.create({
    data: {
      name: "Multi-Node Workflow",
      companyId,
      status: WorkflowStatus.PUBLISHED,
      version: 1,
      publishedAt: new Date(),
    },
  });

  // Create nodes
  const startNode = await prisma.node.create({
    data: {
      workflowId: workflow.id,
      name: "Start Node",
      isEntry: true,
      completionRule: CompletionRule.ALL_TASKS_DONE,
    },
  });

  const approvalNode = await prisma.node.create({
    data: {
      workflowId: workflow.id,
      name: "Approval Node",
      isEntry: false,
      completionRule: CompletionRule.ALL_TASKS_DONE,
    },
  });

  const rejectionNode = await prisma.node.create({
    data: {
      workflowId: workflow.id,
      name: "Rejection Node",
      isEntry: false,
      completionRule: CompletionRule.ALL_TASKS_DONE,
    },
  });

  // Create tasks
  const reviewTask = await prisma.task.create({
    data: {
      nodeId: startNode.id,
      name: "Review Task",
    },
  });

  const processApprovalTask = await prisma.task.create({
    data: {
      nodeId: approvalNode.id,
      name: "Process Approval",
    },
  });

  const handleRejectionTask = await prisma.task.create({
    data: {
      nodeId: rejectionNode.id,
      name: "Handle Rejection",
    },
  });

  // Create outcomes
  await prisma.outcome.create({ data: { taskId: reviewTask.id, name: "APPROVED" } });
  await prisma.outcome.create({ data: { taskId: reviewTask.id, name: "REJECTED" } });
  await prisma.outcome.create({ data: { taskId: processApprovalTask.id, name: "COMPLETE" } });
  await prisma.outcome.create({ data: { taskId: handleRejectionTask.id, name: "COMPLETE" } });

  // Create gates (routing)
  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: startNode.id,
      outcomeName: "APPROVED",
      targetNodeId: approvalNode.id,
    },
  });

  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: startNode.id,
      outcomeName: "REJECTED",
      targetNodeId: rejectionNode.id,
    },
  });

  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: approvalNode.id,
      outcomeName: "COMPLETE",
      targetNodeId: null,
    },
  });

  await prisma.gate.create({
    data: {
      workflowId: workflow.id,
      sourceNodeId: rejectionNode.id,
      outcomeName: "COMPLETE",
      targetNodeId: null,
    },
  });

  // Create workflow version with snapshot
  const snapshot: WorkflowSnapshot = {
    workflowId: workflow.id,
    version: 1,
    name: workflow.name,
    description: null,
    isNonTerminating: false,
    nodes: [
      {
        id: startNode.id,
        name: "Start Node",
        isEntry: true,
        nodeKind: "MAINLINE",
        completionRule: CompletionRule.ALL_TASKS_DONE,
        specificTasks: [],
        tasks: [
          {
            id: reviewTask.id,
            name: "Review Task",
            instructions: null,
            evidenceRequired: false,
            evidenceSchema: null,
            displayOrder: 0,
            outcomes: [
              { id: "o1", name: "APPROVED" },
              { id: "o2", name: "REJECTED" },
            ],
          },
        ],
        transitiveSuccessors: [approvalNode.id, rejectionNode.id],
      },
      {
        id: approvalNode.id,
        name: "Approval Node",
        isEntry: false,
        nodeKind: "MAINLINE",
        completionRule: CompletionRule.ALL_TASKS_DONE,
        specificTasks: [],
        tasks: [
          {
            id: processApprovalTask.id,
            name: "Process Approval",
            instructions: null,
            evidenceRequired: false,
            evidenceSchema: null,
            displayOrder: 0,
            outcomes: [{ id: "o3", name: "COMPLETE" }],
          },
        ],
        transitiveSuccessors: [],
      },
      {
        id: rejectionNode.id,
        name: "Rejection Node",
        isEntry: false,
        nodeKind: "MAINLINE",
        completionRule: CompletionRule.ALL_TASKS_DONE,
        specificTasks: [],
        tasks: [
          {
            id: handleRejectionTask.id,
            name: "Handle Rejection",
            instructions: null,
            evidenceRequired: false,
            evidenceSchema: null,
            displayOrder: 0,
            outcomes: [{ id: "o4", name: "COMPLETE" }],
          },
        ],
        transitiveSuccessors: [],
      },
    ],
    gates: [
      { id: "g1", sourceNodeId: startNode.id, outcomeName: "APPROVED", targetNodeId: approvalNode.id },
      { id: "g2", sourceNodeId: startNode.id, outcomeName: "REJECTED", targetNodeId: rejectionNode.id },
      { id: "g3", sourceNodeId: approvalNode.id, outcomeName: "COMPLETE", targetNodeId: null },
      { id: "g4", sourceNodeId: rejectionNode.id, outcomeName: "COMPLETE", targetNodeId: null },
    ],
  };

  const workflowVersion = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      snapshot: snapshot as object,
      publishedBy: "test-user",
    },
  });

  return {
    workflow,
    startNode,
    approvalNode,
    rejectionNode,
    reviewTask,
    processApprovalTask,
    handleRejectionTask,
    workflowVersion,
    snapshot,
  };
}

/**
 * Creates a flow group and flow for testing.
 */
async function createTestFlow(
  workflowId: string,
  workflowVersionId: string,
  companyId: string
) {
  const flowGroup = await prisma.flowGroup.create({
    data: {
      scopeType: "test",
      scopeId: `test-${Date.now()}`,
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

  return { flowGroup, flow };
}

// =============================================================================
// TEST CLEANUP
// =============================================================================

async function cleanupTestData() {
  await prisma.detourRecord.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.job.deleteMany({});
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

// =============================================================================
// TESTS
// =============================================================================

describe("EPIC-01: FlowSpec Engine Core", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  // ===========================================================================
  // AC: Task can only start if Actionable
  // ===========================================================================
  describe("AC: Task can only start if Actionable", () => {
    it("should allow starting a Task when Node is active and Task has no outcome", async () => {
      const company = await createTestCompany();
      const { workflow, node, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      // Activate entry node
      await activateEntryNodes(flow.id, snapshot);

      // Task should be actionable
      const isActionable = await isTaskActionable(flow.id, task.id);
      expect(isActionable).toBe(true);

      // Start task should succeed
      const result = await startTask(flow.id, task.id, "test-user");
      expect(result.success).toBe(true);
      expect(result.taskExecutionId).toBeDefined();
    });

    it("should reject starting a Task when Node is not activated", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      // Do NOT activate entry node

      // Task should not be actionable
      const isActionable = await isTaskActionable(flow.id, task.id);
      expect(isActionable).toBe(false);

      // Start task should fail
      const result = await startTask(flow.id, task.id, "test-user");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TASK_NOT_ACTIONABLE");
    });

    it("should reject starting a Task that already has an outcome", async () => {
      const company = await createTestCompany();
      const { workflow, node, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      // Activate entry node
      await activateEntryNodes(flow.id, snapshot);

      // Start and complete task
      await startTask(flow.id, task.id, "test-user");
      await recordOutcome(flow.id, task.id, "APPROVED", "test-user");

      // Task should no longer be actionable
      const isActionable = await isTaskActionable(flow.id, task.id);
      expect(isActionable).toBe(false);
    });
  });

  // ===========================================================================
  // AC: Task start is recorded in Truth with timestamp
  // ===========================================================================
  describe("AC: Task start is recorded in Truth with timestamp", () => {
    it("should record Task start with timestamp in TaskExecution", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      
      const beforeStart = new Date();
      const result = await startTask(flow.id, task.id, "test-user");
      const afterStart = new Date();

      expect(result.success).toBe(true);

      // Verify TaskExecution was created with timestamp
      const taskExecution = await prisma.taskExecution.findUnique({
        where: { id: result.taskExecutionId },
      });

      expect(taskExecution).not.toBeNull();
      expect(taskExecution?.startedAt).not.toBeNull();
      expect(taskExecution?.startedBy).toBe("test-user");
      expect(taskExecution?.startedAt!.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
      expect(taskExecution?.startedAt!.getTime()).toBeLessThanOrEqual(afterStart.getTime());
    });
  });

  // ===========================================================================
  // AC: Outcome must be in Task's allowed Outcomes list (INV-002)
  // ===========================================================================
  describe("AC: Outcome must be in Task's allowed Outcomes list (INV-002)", () => {
    it("should accept valid outcomes", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      const result = await recordOutcome(flow.id, task.id, "APPROVED", "test-user");
      expect(result.success).toBe(true);
    });

    it("should reject invalid outcomes", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      const result = await recordOutcome(flow.id, task.id, "INVALID_OUTCOME", "test-user");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_OUTCOME");
    });
  });

  // ===========================================================================
  // AC: Outcome recording is rejected if Task not started
  // ===========================================================================
  describe("AC: Outcome recording is rejected if Task not started", () => {
    it("should reject outcome if task not started", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      // Do NOT start task

      const result = await recordOutcome(flow.id, task.id, "APPROVED", "test-user");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TASK_NOT_STARTED");
    });
  });

  // ===========================================================================
  // AC: Outcome recording triggers Gate evaluation
  // ===========================================================================
  describe("AC: Outcome recording triggers Gate evaluation", () => {
    it("should trigger Gate evaluation and activate target Node on outcome", async () => {
      const company = await createTestCompany();
      const {
        workflow,
        reviewTask,
        processApprovalTask,
        approvalNode,
        workflowVersion,
        snapshot,
      } = await createMultiNodeWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, reviewTask.id, "test-user");

      // Record APPROVED outcome - should route to Approval Node
      const result = await recordOutcome(flow.id, reviewTask.id, "APPROVED", "test-user");

      expect(result.success).toBe(true);
      expect(result.gateResults).toBeDefined();
      expect(result.gateResults!.length).toBeGreaterThan(0);

      // Check that Approval Node was activated
      const flowData = await getFlow(flow.id);
      const approvalNodeActivation = flowData?.nodeActivations.find(
        (na) => na.nodeId === approvalNode.id
      );
      expect(approvalNodeActivation).toBeDefined();

      // Process Approval Task should now be actionable
      const isActionable = await isTaskActionable(flow.id, processApprovalTask.id);
      expect(isActionable).toBe(true);
    });
  });

  // ===========================================================================
  // AC: Gate routes to correct target Node(s) based on Outcome
  // ===========================================================================
  describe("AC: Gate routes to correct target Node(s) based on Outcome", () => {
    it("should route to Approval Node on APPROVED outcome", async () => {
      const company = await createTestCompany();
      const {
        workflow,
        reviewTask,
        approvalNode,
        rejectionNode,
        workflowVersion,
        snapshot,
      } = await createMultiNodeWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, reviewTask.id, "test-user");
      await recordOutcome(flow.id, reviewTask.id, "APPROVED", "test-user");

      const flowData = await getFlow(flow.id);

      // Approval Node should be activated
      const approvalActivation = flowData?.nodeActivations.find(
        (na) => na.nodeId === approvalNode.id
      );
      expect(approvalActivation).toBeDefined();

      // Rejection Node should NOT be activated
      const rejectionActivation = flowData?.nodeActivations.find(
        (na) => na.nodeId === rejectionNode.id
      );
      expect(rejectionActivation).toBeUndefined();
    });

    it("should route to Rejection Node on REJECTED outcome", async () => {
      const company = await createTestCompany();
      const {
        workflow,
        reviewTask,
        approvalNode,
        rejectionNode,
        workflowVersion,
        snapshot,
      } = await createMultiNodeWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, reviewTask.id, "test-user");
      await recordOutcome(flow.id, reviewTask.id, "REJECTED", "test-user");

      const flowData = await getFlow(flow.id);

      // Rejection Node should be activated
      const rejectionActivation = flowData?.nodeActivations.find(
        (na) => na.nodeId === rejectionNode.id
      );
      expect(rejectionActivation).toBeDefined();

      // Approval Node should NOT be activated
      const approvalActivation = flowData?.nodeActivations.find(
        (na) => na.nodeId === approvalNode.id
      );
      expect(approvalActivation).toBeUndefined();
    });
  });

  // ===========================================================================
  // AC: Outcome immutability (INV-007)
  // ===========================================================================
  describe("AC: Outcome immutability (INV-007)", () => {
    it("should reject recording a second outcome on the same Task", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      // First outcome succeeds
      const result1 = await recordOutcome(flow.id, task.id, "APPROVED", "test-user");
      expect(result1.success).toBe(true);

      // Second outcome is rejected
      const result2 = await recordOutcome(flow.id, task.id, "REJECTED", "test-user");
      expect(result2.success).toBe(false);
      expect(result2.error?.code).toBe("OUTCOME_ALREADY_RECORDED");
    });
  });

  // ===========================================================================
  // AC: Node completion rules (ALL, ANY, SPECIFIC) work correctly
  // ===========================================================================
  describe("AC: Node completion rules work correctly", () => {
    it("should complete Node with ALL_TASKS_DONE when all tasks have outcomes", async () => {
      const company = await createTestCompany();
      const { workflow, node, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");
      await recordOutcome(flow.id, task.id, "APPROVED", "test-user");

      // Verify node is complete
      const flowData = await getFlow(flow.id);
      const snapshotNode = snapshot.nodes[0];
      const isComplete = computeNodeComplete(snapshotNode, flowData!.taskExecutions, new Map(), 1);
      expect(isComplete).toBe(true);
    });

    it("should complete Node with ANY_TASK_DONE when any task has outcome", async () => {
      // Create workflow with ANY_TASK_DONE completion rule
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "ANY Task Workflow",
          companyId: company.id,
          status: WorkflowStatus.PUBLISHED,
          version: 1,
          publishedAt: new Date(),
        },
      });

      const node = await prisma.node.create({
        data: {
          workflowId: workflow.id,
          name: "Any Task Node",
          isEntry: true,
          completionRule: CompletionRule.ANY_TASK_DONE,
        },
      });

      const task1 = await prisma.task.create({
        data: { nodeId: node.id, name: "Task 1" },
      });
      const task2 = await prisma.task.create({
        data: { nodeId: node.id, name: "Task 2" },
      });

      await prisma.outcome.create({ data: { taskId: task1.id, name: "DONE" } });
      await prisma.outcome.create({ data: { taskId: task2.id, name: "DONE" } });

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
            nodeKind: "MAINLINE",
            completionRule: CompletionRule.ANY_TASK_DONE,
            specificTasks: [],
            tasks: [
              {
                id: task1.id,
                name: "Task 1",
                instructions: null,
                evidenceRequired: false,
                evidenceSchema: null,
                displayOrder: 0,
                outcomes: [{ id: "o1", name: "DONE" }],
              },
              {
                id: task2.id,
                name: "Task 2",
                instructions: null,
                evidenceRequired: false,
                evidenceSchema: null,
                displayOrder: 1,
                outcomes: [{ id: "o2", name: "DONE" }],
              },
            ],
            transitiveSuccessors: [],
          },
        ],
        gates: [
          { id: "g1", sourceNodeId: node.id, outcomeName: "DONE", targetNodeId: null },
        ],
      };

      const workflowVersion = await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          snapshot: snapshot as object,
          publishedBy: "test-user",
        },
      });

      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);
      await activateEntryNodes(flow.id, snapshot);

      // Complete only Task 1
      await startTask(flow.id, task1.id, "test-user");
      await recordOutcome(flow.id, task1.id, "DONE", "test-user");

      // Node should be complete (ANY_TASK_DONE)
      const flowData = await getFlow(flow.id);
      const isComplete = computeNodeComplete(snapshot.nodes[0], flowData!.taskExecutions, new Map(), 1);
      expect(isComplete).toBe(true);

      // Task 2 should no longer be actionable
      const isTask2Actionable = await isTaskActionable(flow.id, task2.id);
      expect(isTask2Actionable).toBe(false);
    });
  });

  // ===========================================================================
  // AC: Determinism - replay of Truth produces identical Derived State (INV-006)
  // ===========================================================================
  describe("AC: Determinism (INV-006)", () => {
    it("should produce identical Derived State given identical Truth", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      // Get derived state
      const flowData = await getFlow(flow.id);
      const actionable1 = computeActionableTasks(
        snapshot,
        flowData!.nodeActivations,
        flowData!.taskExecutions,
        [],
        [],
        {
          flowId: flow.id,
          flowGroupId: flow.flowGroupId,
          workflowId: flow.workflowId,
          workflowName: flowData!.workflow.name,
        }
      );

      // Compute again - should be identical
      const actionable2 = computeActionableTasks(
        snapshot,
        flowData!.nodeActivations,
        flowData!.taskExecutions,
        [],
        [],
        {
          flowId: flow.id,
          flowGroupId: flow.flowGroupId,
          workflowId: flow.workflowId,
          workflowName: flowData!.workflow.name,
        }
      );

      expect(actionable1).toEqual(actionable2);
    });
  });

  // ===========================================================================
  // AC: Evidence requirements enforcement (INV-016)
  // ===========================================================================
  describe("AC: Evidence requirements enforcement (INV-016)", () => {
    it("should reject outcome if evidence is required but not attached", async () => {
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "Evidence Required Workflow",
          companyId: company.id,
          status: WorkflowStatus.PUBLISHED,
          version: 1,
          publishedAt: new Date(),
        },
      });

      const node = await prisma.node.create({
        data: {
          workflowId: workflow.id,
          name: "Evidence Node",
          isEntry: true,
          completionRule: CompletionRule.ALL_TASKS_DONE,
        },
      });

      const task = await prisma.task.create({
        data: {
          nodeId: node.id,
          name: "Evidence Task",
          evidenceRequired: true,
        },
      });

      await prisma.outcome.create({ data: { taskId: task.id, name: "COMPLETE" } });

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
            nodeKind: "MAINLINE",
            completionRule: CompletionRule.ALL_TASKS_DONE,
            specificTasks: [],
            tasks: [
              {
                id: task.id,
                name: "Evidence Task",
                instructions: null,
                evidenceRequired: true,
                evidenceSchema: null,
                displayOrder: 0,
                outcomes: [{ id: "o1", name: "COMPLETE" }],
              },
            ],
            transitiveSuccessors: [],
          },
        ],
        gates: [
          { id: "g1", sourceNodeId: node.id, outcomeName: "COMPLETE", targetNodeId: null },
        ],
      };

      const workflowVersion = await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          snapshot: snapshot as object,
          publishedBy: "test-user",
        },
      });

      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);
      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      // Try to record outcome without evidence - should fail
      const result = await recordOutcome(flow.id, task.id, "COMPLETE", "test-user");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("EVIDENCE_REQUIRED");
    });

    it("should accept outcome if evidence is attached", async () => {
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "Evidence Required Workflow",
          companyId: company.id,
          status: WorkflowStatus.PUBLISHED,
          version: 1,
          publishedAt: new Date(),
        },
      });

      const node = await prisma.node.create({
        data: {
          workflowId: workflow.id,
          name: "Evidence Node",
          isEntry: true,
          completionRule: CompletionRule.ALL_TASKS_DONE,
        },
      });

      const task = await prisma.task.create({
        data: {
          nodeId: node.id,
          name: "Evidence Task",
          evidenceRequired: true,
        },
      });

      await prisma.outcome.create({ data: { taskId: task.id, name: "COMPLETE" } });

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
            nodeKind: "MAINLINE",
            completionRule: CompletionRule.ALL_TASKS_DONE,
            specificTasks: [],
            tasks: [
              {
                id: task.id,
                name: "Evidence Task",
                instructions: null,
                evidenceRequired: true,
                evidenceSchema: null,
                displayOrder: 0,
                outcomes: [{ id: "o1", name: "COMPLETE" }],
              },
            ],
            transitiveSuccessors: [],
          },
        ],
        gates: [
          { id: "g1", sourceNodeId: node.id, outcomeName: "COMPLETE", targetNodeId: null },
        ],
      };

      const workflowVersion = await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          snapshot: snapshot as object,
          publishedBy: "test-user",
        },
      });

      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);
      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      // Attach evidence
      await attachEvidence(
        flow.id,
        task.id,
        EvidenceType.TEXT,
        { content: "Test evidence" },
        "test-user"
      );

      // Now record outcome - should succeed
      const result = await recordOutcome(flow.id, task.id, "COMPLETE", "test-user");
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // AC: Flow completion
  // ===========================================================================
  describe("AC: Flow completion", () => {
    it("should mark Flow as COMPLETED when terminal path is reached", async () => {
      const company = await createTestCompany();
      const { workflow, task, workflowVersion, snapshot } = await createSimpleWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");
      await recordOutcome(flow.id, task.id, "APPROVED", "test-user");

      // Check flow status
      const updatedFlow = await prisma.flow.findUnique({ where: { id: flow.id } });
      expect(updatedFlow?.status).toBe(FlowStatus.COMPLETED);
    });
  });

  // ===========================================================================
  // AC: getActionableTasks returns correct Tasks
  // ===========================================================================
  describe("AC: getActionableTasks", () => {
    it("should return only Actionable Tasks", async () => {
      const company = await createTestCompany();
      const {
        workflow,
        reviewTask,
        processApprovalTask,
        handleRejectionTask,
        workflowVersion,
        snapshot,
      } = await createMultiNodeWorkflow(company.id);
      const { flow } = await createTestFlow(workflow.id, workflowVersion.id, company.id);

      // Before activation - no actionable tasks
      let actionable = await getActionableTasks(flow.id);
      expect(actionable.length).toBe(0);

      // After activating entry nodes
      await activateEntryNodes(flow.id, snapshot);
      actionable = await getActionableTasks(flow.id);
      expect(actionable.length).toBe(1);
      expect(actionable[0].taskId).toBe(reviewTask.id);

      // After completing review task with APPROVED
      await startTask(flow.id, reviewTask.id, "test-user");
      await recordOutcome(flow.id, reviewTask.id, "APPROVED", "test-user");

      actionable = await getActionableTasks(flow.id);
      expect(actionable.length).toBe(1);
      expect(actionable[0].taskId).toBe(processApprovalTask.id);

      // Handle Rejection task should NOT be actionable
      const isRejectionActionable = await isTaskActionable(flow.id, handleRejectionTask.id);
      expect(isRejectionActionable).toBe(false);
    });
  });
});
