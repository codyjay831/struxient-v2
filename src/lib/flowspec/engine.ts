/**
 * FlowSpec Engine Core
 *
 * Canon Source: 10_flowspec_engine_contract.md
 * Epic: EPIC-01 FlowSpec Engine Core
 *
 * FlowSpec IS the execution engine. It defines AND executes workflows.
 * This is the primary interface for all FlowSpec operations.
 *
 * FOUNDATIONAL BOUNDARY (NON-NEGOTIABLE):
 * FlowSpec is the sole engine responsible for defining and executing workflows.
 * The Work Station does not execute workflows; it exists solely to perform
 * and submit human work (tasks) into FlowSpec.
 *
 * AUTHORIZATION BOUNDARY:
 * The FlowSpec Engine does NOT perform authorization checks. It trusts that
 * the API layer has verified tenant ownership (actor's companyId matches
 * Flow's companyId) before invoking any function.
 *
 * INVARIANTS ENFORCED:
 * - INV-001: No work outside Tasks
 * - INV-002: Explicit outcomes only
 * - INV-003: Gates route only
 * - INV-006: Determinism
 * - INV-007: Outcome immutability
 * - INV-009: FlowSpec owns Truth
 * - INV-010: Flow bound to version
 * - INV-012: Graph-first execution
 * - INV-013: No inferred Task state
 * - INV-019: FlowSpec evaluates Actionability
 * - INV-022: Actionability at start only
 * - INV-024: Gate key is Node-level
 */

import { prisma } from "@/lib/prisma";
import type { Flow, NodeActivation, TaskExecution, EvidenceAttachment } from "@prisma/client";
import { FlowStatus, EvidenceType } from "@prisma/client";
import type {
  WorkflowSnapshot,
  SnapshotNode,
  ActionableTask,
  RecordTaskStartResult,
  RecordOutcomeResult,
  GateEvaluationResult,
  NodeActivationResult,
  EngineError,
  FlowWithRelations,
} from "./types";
import { isValidOutcome } from "./types";
import {
  recordNodeActivation,
  recordTaskStart as truthRecordTaskStart,
  recordOutcome as truthRecordOutcome,
  attachEvidence as truthAttachEvidence,
  getNodeActivations,
  getTaskExecutions,
  getTaskEvidence,
  getLatestNodeActivation,
  updateFlowStatus,
  getFlowGroupOutcomes,
} from "./truth";
import {
  computeActionableTasks,
  computeTaskActionable,
  computeNodeComplete,
  computeFlowComplete,
  evaluateGates,
} from "./derived";
import { checkEvidenceRequirements, validateEvidenceData, type EvidenceSchema } from "./evidence";
import { executeFanOut } from "./instantiation/fanout";

// =============================================================================
// FLOW OPERATIONS
// =============================================================================

/**
 * Gets a Flow with all related execution data.
 *
 * @param flowId - The Flow ID
 * @returns The Flow with relations or null
 */
export async function getFlow(flowId: string): Promise<FlowWithRelations | null> {
  return prisma.flow.findUnique({
    where: { id: flowId },
    include: {
      workflow: true,
      workflowVersion: true,
      flowGroup: true,
      nodeActivations: true,
      taskExecutions: true,
      evidenceAttachments: true,
    },
  });
}

/**
 * Gets the Workflow snapshot for a Flow.
 * The snapshot is the immutable workflow structure at the time of publishing.
 *
 * @param flow - The Flow with workflowVersion
 * @returns The WorkflowSnapshot
 */
export function getWorkflowSnapshot(flow: FlowWithRelations): WorkflowSnapshot {
  return flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
}

// =============================================================================
// TASK OPERATIONS
// Canon: 10_flowspec_engine_contract.md §5.1
// =============================================================================

/**
 * Starts a Task.
 * A Task can only be started if it is Actionable.
 *
 * INV-022: Actionability constraints evaluated at Task start only.
 * Once a Task is started, constraints are not re-checked to block Outcome recording.
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @param userId - The user starting the Task
 * @returns RecordTaskStartResult
 */
export async function startTask(
  flowId: string,
  taskId: string,
  userId: string
): Promise<RecordTaskStartResult> {
  // Get Flow with all execution data
  const flow = await getFlow(flowId);

  if (!flow) {
    return {
      success: false,
      error: {
        code: "FLOW_NOT_FOUND",
        message: `Flow ${flowId} not found`,
      },
    };
  }

  if (flow.status === FlowStatus.BLOCKED) {
    return {
      success: false,
      error: {
        code: "FLOW_BLOCKED",
        message: `Flow ${flowId} is BLOCKED and cannot start new tasks. Contact admin.`,
      },
    };
  }

  const snapshot = getWorkflowSnapshot(flow);

  // Find the Task in the snapshot
  const { node, task } = findTaskInSnapshot(snapshot, taskId);

  if (!task || !node) {
    return {
      success: false,
      error: {
        code: "TASK_NOT_FOUND",
        message: `Task ${taskId} not found in workflow`,
      },
    };
  }

  // Get Flow Group outcomes for Cross-Flow Dependencies
  const groupOutcomes = await getFlowGroupOutcomes(flow.flowGroupId);

  // Check if Task is Actionable
  const isActionable = computeTaskActionable(
    task,
    node,
    flow.nodeActivations,
    flow.taskExecutions,
    groupOutcomes
  );

  if (!isActionable) {
    return {
      success: false,
      error: {
        code: "TASK_NOT_ACTIONABLE",
        message: `Task ${taskId} is not currently Actionable`,
        details: {
          taskId,
          nodeId: node.id,
          nodeName: node.name,
          taskName: task.name,
        },
      },
    };
  }

  // Get current iteration for the Node
  const latestActivation = await getLatestNodeActivation(flowId, node.id);
  const iteration = latestActivation?.iteration ?? 1;

  // Check if already started for this iteration
  const existingExecution = flow.taskExecutions.find(
    (te) => te.taskId === taskId && te.iteration === iteration
  );

  if (existingExecution?.startedAt) {
    return {
      success: false,
      error: {
        code: "TASK_ALREADY_STARTED",
        message: `Task ${taskId} has already been started for iteration ${iteration}`,
        details: {
          taskExecutionId: existingExecution.id,
          startedAt: existingExecution.startedAt,
          startedBy: existingExecution.startedBy,
        },
      },
    };
  }

  // Record Task start in Truth
  const taskExecution = await truthRecordTaskStart(
    flowId,
    taskId,
    userId,
    latestActivation?.id,
    iteration
  );

  return {
    success: true,
    taskExecutionId: taskExecution.id,
  };
}

/**
 * Records an Outcome on a Task.
 * INV-007: Outcomes are immutable once recorded.
 *
 * This function:
 * 1. Validates the Outcome is allowed
 * 2. Checks evidence requirements (if any)
 * 3. Records the Outcome in Truth (inside $transaction)
 * 4. Evaluates Gates and activates target Nodes (inside $transaction)
 * 5. Executes Fan-Out (outside $transaction)
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @param outcome - The outcome value
 * @param userId - The user recording the outcome
 * @returns RecordOutcomeResult
 */
export async function recordOutcome(
  flowId: string,
  taskId: string,
  outcome: string,
  userId: string
): Promise<RecordOutcomeResult> {
  // 1. Pre-transaction validation
  const flow = await getFlow(flowId);
  if (!flow) {
    return {
      success: false,
      error: { code: "FLOW_NOT_FOUND", message: `Flow ${flowId} not found` },
    };
  }

  if (flow.status === FlowStatus.BLOCKED) {
    return {
      success: false,
      error: { code: "FLOW_BLOCKED", message: `Flow ${flowId} is BLOCKED. Contact admin.` },
    };
  }

  const snapshot = getWorkflowSnapshot(flow);
  const { node, task } = findTaskInSnapshot(snapshot, taskId);

  if (!task || !node) {
    return {
      success: false,
      error: { code: "TASK_NOT_FOUND", message: `Task ${taskId} not found in workflow` },
    };
  }

  // 2. Business logic validation
  const latestActivation = await getLatestNodeActivation(flowId, node.id);
  const iteration = latestActivation?.iteration ?? 1;
  const taskExecution = flow.taskExecutions.find(
    (te) => te.taskId === taskId && te.iteration === iteration
  );

  if (!taskExecution?.startedAt) {
    return {
      success: false,
      error: { code: "TASK_NOT_STARTED", message: `Task ${taskId} has not been started.` },
    };
  }

  const allowedOutcomes = task.outcomes.map((o) => o.name);
  if (!isValidOutcome(outcome, allowedOutcomes)) {
    return {
      success: false,
      error: { code: "INVALID_OUTCOME", message: `Outcome "${outcome}" is not valid` },
    };
  }

  if (task.evidenceRequired) {
    const evidence = await getTaskEvidence(flowId, taskId);
    const requirementResult = checkEvidenceRequirements(task, evidence);
    if (!requirementResult.satisfied) {
      return {
        success: false,
        error: { code: "EVIDENCE_REQUIRED", message: requirementResult.error || "Evidence required" },
      };
    }
  }

  // 3. Atomic Unit of Progress
  const now = new Date(); // Tighten-up C: Single timestamp for atomic unit
  
  let resultRecord: TaskExecution | undefined;
  let gateResults: GateEvaluationResult[] = [];
  let fanOutIntent: {
    nodeId: string;
    outcome: string;
    scope: { type: string; id: string };
    companyId: string;
    flowGroupId: string;
  } | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // a. Record Outcome (Tighten-up B: propagate tx)
      const outcomeResult = await truthRecordOutcome(flowId, taskId, outcome, userId, iteration, tx, now);
      if (outcomeResult.error) throw new Error(JSON.stringify(outcomeResult.error));
      resultRecord = outcomeResult.taskExecution;

      // b. Routing (Node Activations)
      gateResults = await processGateRouting(flow, snapshot, node, iteration, tx, now);

      // c. Check if Node completed for Fan-Out intent
      const updatedExecutions = await getTaskExecutions(flowId, tx);
      const nodeIsComplete = computeNodeComplete(node, updatedExecutions, iteration);
      if (nodeIsComplete) {
        fanOutIntent = {
          nodeId: node.id,
          outcome,
          scope: { type: flow.flowGroup.scopeType, id: flow.flowGroup.scopeId },
          companyId: flow.workflow.companyId,
          flowGroupId: flow.flowGroupId
        };
      }

      // d. Flow Completion check
      const currentActivations = await tx.nodeActivation.findMany({ where: { flowId } });
      const isComplete = computeFlowComplete(snapshot, currentActivations, updatedExecutions);
      if (isComplete && flow.status !== FlowStatus.BLOCKED) {
        await updateFlowStatus(flowId, FlowStatus.COMPLETED, undefined, tx, now);
      }
    });
  } catch (err) {
    // If it's one of our thrown errors, return it
    try {
      const parsed = JSON.parse((err as Error).message);
      if (parsed.code) return { success: false, error: parsed };
    } catch { /* ignore */ }
    throw err;
  }

  // 4. Side Effects (OUTSIDE_TX)
  // Tighten-up A: Fanout failure MUST NOT roll back core truth.
  if (fanOutIntent) {
    try {
      await executeFanOut(
        flowId,
        fanOutIntent.nodeId,
        fanOutIntent.outcome,
        fanOutIntent.scope,
        fanOutIntent.companyId,
        fanOutIntent.flowGroupId
      );
    } catch (err) {
      console.error("[FlowSpec] Fan-out failure (non-blocking for core truth):", err);
      // Fanout is best-effort and must be retried via separate mechanism
    }
  }

  return {
    success: true,
    taskExecutionId: resultRecord!.id,
    gateResults,
  };
}

/**
 * Attaches Evidence to a Task.
 * INV-005: Evidence is always attached to exactly one Task.
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @param type - Evidence type
 * @param data - Evidence data
 * @param userId - The user attaching evidence
 * @param idempotencyKey - Optional idempotency key
 * @returns The EvidenceAttachment or error
 */
export async function attachEvidence(
  flowId: string,
  taskId: string,
  type: EvidenceType,
  data: unknown,
  userId: string,
  idempotencyKey?: string
): Promise<{ evidenceAttachment?: EvidenceAttachment; error?: EngineError }> {
  // Verify Flow exists
  const flow = await getFlow(flowId);

  if (!flow) {
    return {
      error: {
        code: "FLOW_NOT_FOUND",
        message: `Flow ${flowId} not found`,
      },
    };
  }

  const snapshot = getWorkflowSnapshot(flow);

  // Verify Task exists in workflow
  const { task } = findTaskInSnapshot(snapshot, taskId);

  if (!task) {
    return {
      error: {
        code: "TASK_NOT_FOUND",
        message: `Task ${taskId} not found in workflow`,
      },
    };
  }

  // Get current iteration for the Node
  const { node } = findTaskInSnapshot(snapshot, taskId);
  const latestActivation = node
    ? await getLatestNodeActivation(flowId, node.id)
    : null;
  const iteration = latestActivation?.iteration ?? 1;

  // Find the TaskExecution if it exists
  const taskExecution = flow.taskExecutions.find(
    (te) => te.taskId === taskId && te.iteration === iteration
  );

  // Validate against schema if exists
  if (task.evidenceSchema) {
    const validationResult = validateEvidenceData(
      type,
      data,
      task.evidenceSchema as unknown as EvidenceSchema
    );
    if (!validationResult.valid) {
      return {
        error: {
          code: "INVALID_EVIDENCE_FORMAT",
          message: validationResult.error || "Evidence does not match required schema",
          details: {
            taskId,
            evidenceSchema: task.evidenceSchema,
          },
        },
      };
    }
  }

  // Attach evidence in Truth
  return truthAttachEvidence(
    flowId,
    taskId,
    type,
    data,
    userId,
    taskExecution?.id,
    idempotencyKey
  );
}

// =============================================================================
// ACTIONABILITY QUERIES
// Canon: 10_flowspec_engine_contract.md §9.1
// =============================================================================

/**
 * Gets all Actionable Tasks for a Flow.
 * INV-019: FlowSpec evaluates all Actionability.
 *
 * @param flowId - The Flow ID
 * @returns Array of ActionableTask objects
 */
export async function getActionableTasks(flowId: string): Promise<ActionableTask[]> {
  const flow = await getFlow(flowId);

  if (!flow) {
    return [];
  }

  const snapshot = getWorkflowSnapshot(flow);

  // Fetch group outcomes for cross-flow dependency evaluation
  const groupOutcomes = await getFlowGroupOutcomes(flow.flowGroupId);

  return computeActionableTasks(
    snapshot,
    flow.nodeActivations,
    flow.taskExecutions,
    {
      flowId,
      flowGroupId: flow.flowGroupId,
      workflowId: flow.workflowId,
      workflowName: flow.workflow.name,
    },
    groupOutcomes
  );
}

/**
 * Checks if a specific Task is Actionable.
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @returns True if the Task is Actionable
 */
export async function isTaskActionable(
  flowId: string,
  taskId: string
): Promise<boolean> {
  const flow = await getFlow(flowId);

  if (!flow) {
    return false;
  }

  const snapshot = getWorkflowSnapshot(flow);
  const { node, task } = findTaskInSnapshot(snapshot, taskId);

  if (!task || !node) {
    return false;
  }

  const groupOutcomes = await getFlowGroupOutcomes(flow.flowGroupId);

  return computeTaskActionable(
    task,
    node,
    flow.nodeActivations,
    flow.taskExecutions,
    groupOutcomes
  );
}

// =============================================================================
// NODE OPERATIONS
// Canon: 10_flowspec_engine_contract.md §5.2
// =============================================================================

/**
 * Activates a Node (Entry Node or via Gate routing).
 * Creates a NodeActivation record in Truth.
 *
 * @param flowId - The Flow ID
 * @param nodeId - The Node ID
 * @param iteration - Optional iteration (for cycles, defaults to calculated)
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @returns NodeActivationResult
 */
export async function activateNode(
  flowId: string,
  nodeId: string,
  iteration?: number,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<NodeActivationResult> {
  // Calculate iteration if not provided
  let activationIteration = iteration;
  if (activationIteration === undefined) {
    const latestActivation = await getLatestNodeActivation(flowId, nodeId, tx);
    activationIteration = latestActivation ? latestActivation.iteration + 1 : 1;
  }

  // Record NodeActivation in Truth
  const nodeActivation = await recordNodeActivation(
    flowId,
    nodeId,
    activationIteration,
    tx,
    now
  );

  return {
    success: true,
    nodeActivationId: nodeActivation.id,
    iteration: nodeActivation.iteration,
  };
}

/**
 * Activates Entry Nodes for a newly created Flow.
 * Called when a Flow is instantiated.
 *
 * @param flowId - The Flow ID
 * @param snapshot - The Workflow snapshot
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @returns Array of NodeActivationResult
 */
export async function activateEntryNodes(
  flowId: string,
  snapshot: WorkflowSnapshot,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<NodeActivationResult[]> {
  const entryNodes = snapshot.nodes.filter((n) => n.isEntry);
  const results: NodeActivationResult[] = [];

  for (const node of entryNodes) {
    const result = await activateNode(flowId, node.id, 1, tx, now);
    results.push(result);
  }

  return results;
}

// =============================================================================
// GATE ROUTING
// Canon: 10_flowspec_engine_contract.md §5.5
// =============================================================================

/**
 * Processes Gate routing after a Node is completed.
 * Evaluates Gates and activates target Nodes.
 *
 * @param flow - The Flow with execution data
 * @param snapshot - The Workflow snapshot
 * @param node - The completed Node
 * @param iteration - The current iteration
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @returns Array of GateEvaluationResult
 */
async function processGateRouting(
  flow: FlowWithRelations,
  snapshot: WorkflowSnapshot,
  node: SnapshotNode,
  iteration: number,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<GateEvaluationResult[]> {
  // Re-fetch task executions to get latest state (Tighten-up B: use tx)
  const taskExecutions = await getTaskExecutions(flow.id, tx);

  // Check if Node is complete
  const isComplete = computeNodeComplete(node, taskExecutions, iteration);

  if (!isComplete) {
    // Node not complete yet, no gate routing
    return [];
  }

  // Evaluate Gates
  const routes = evaluateGates(node, taskExecutions, snapshot.gates, iteration);
  const results: GateEvaluationResult[] = [];

  for (const route of routes) {
    if (route.targetNodeId === null) {
      // Terminal path - no activation needed
      results.push({
        gateId: route.gateId,
        sourceNodeId: route.sourceNodeId,
        outcomeName: route.outcomeName,
        targetNodeId: null,
        activated: false,
        isTerminal: true, // Marker for terminal paths
      } as any);
    } else {
      // Activate target Node (handles cycles automatically)
      const activationResult = await activateNode(flow.id, route.targetNodeId, undefined, tx, now);
      results.push({
        gateId: route.gateId,
        sourceNodeId: route.sourceNodeId,
        outcomeName: route.outcomeName,
        targetNodeId: route.targetNodeId,
        activated: activationResult.success,
      });
    }
  }

  return results;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Finds a Task and its containing Node in the Workflow snapshot.
 *
 * @param snapshot - The Workflow snapshot
 * @param taskId - The Task ID
 * @returns Object containing the node and task, or undefined values
 */
function findTaskInSnapshot(
  snapshot: WorkflowSnapshot,
  taskId: string
): { node?: SnapshotNode; task?: SnapshotNode["tasks"][0] } {
  for (const node of snapshot.nodes) {
    const task = node.tasks.find((t) => t.id === taskId);
    if (task) {
      return { node, task };
    }
  }
  return {};
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  WorkflowSnapshot,
  ActionableTask,
  RecordTaskStartResult,
  RecordOutcomeResult,
  GateEvaluationResult,
  NodeActivationResult,
  EngineError,
};

export { FlowStatus, EvidenceType };
