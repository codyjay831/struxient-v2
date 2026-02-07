/**
 * FlowSpec Derived State Computation
 *
 * Canon Source: 00_flowspec_glossary.md §3.2, 10_flowspec_engine_contract.md
 * Epic: EPIC-01 FlowSpec Engine Core
 *
 * Derived State is computed, non-authoritative state derived from Truth.
 * Derived State is recalculated on demand.
 *
 * INVARIANTS ENFORCED:
 * - INV-006: Determinism - same Truth → same Derived State
 * - INV-019: FlowSpec evaluates all Actionability
 * - INV-013: No inferred Task state - state from Truth only
 * - INV-012: Graph-first execution - order from graph, not display
 *
 * DETERMINISM GUARANTEE:
 * All functions in this module are pure functions that compute state
 * from Truth. Given identical Truth, they MUST produce identical results.
 */

import type { NodeActivation, TaskExecution, ValidityEvent, DetourRecord } from "@prisma/client";
import { CompletionRule, ValidityState, DetourStatus, DetourType } from "@prisma/client";
import type {
  WorkflowSnapshot,
  SnapshotNode,
  SnapshotTask,
  SnapshotGate,
  DerivedNodeState,
  DerivedTaskState,
  ActionableTask,
  GateRoute,
  GroupOutcome,
  ReasonCode,
  ActionRefusal,
} from "./types";

// =============================================================================
// VALIDITY DERIVATION (PURE)
// = : Phase-2 Lock 1 : accepts pre-fetched events
// =============================================================================

/**
 * Derives the latest validity state for a set of TaskExecutions.
 * Tie-break rule: (createdAt DESC, id DESC).
 * Default: VALID.
 */
export function computeValidityMap(
  validityEvents: ValidityEvent[]
): Map<string, ValidityState> {
  const map = new Map<string, ValidityState>();
  
  // Sort events to ensure latest wins
  const sorted = [...validityEvents].sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  for (const event of sorted) {
    if (!map.has(event.taskExecutionId)) {
      map.set(event.taskExecutionId, event.state);
    }
  }

  return map;
}

/**
 * Helper to get validity for a single task execution from a map.
 */
function getTaskValidity(
  taskExecutionId: string | undefined,
  validityMap: Map<string, ValidityState>
): ValidityState {
  if (!taskExecutionId) return ValidityState.VALID;
  return validityMap.get(taskExecutionId) ?? ValidityState.VALID;
}

// =============================================================================
// BLOCKING SCOPE DERIVATION (PURE)
// =============================================================================

/**
 * Returns a set of Node IDs that are currently blocked by ACTIVE BLOCKING detours.
 * Uses publish-time transitiveSuccessors from snapshot.
 *
 * LOCK: computeBlockedNodes must never block the checkpoint node for its own detour.
 */
export function computeBlockedNodes(
  detours: DetourRecord[],
  snapshot: WorkflowSnapshot
): Set<string> {
  const blockedNodes = new Set<string>();
  
  const activeBlockingDetours = detours.filter(
    d => d.status === DetourStatus.ACTIVE && d.type === DetourType.BLOCKING
  );

  for (const detour of activeBlockingDetours) {
    const node = snapshot.nodes.find(n => n.id === detour.checkpointNodeId);
    if (node) {
      // Add checkpoint itself (blocking detours block their own checkpoint node for standard progress)
      blockedNodes.add(node.id);
      // Add all pre-computed transitive successors
      for (const successorId of node.transitiveSuccessors) {
        blockedNodes.add(successorId);
      }
    }
  }

  return blockedNodes;
}

// =============================================================================
// NODE STATE COMPUTATION
// Canon: 10_flowspec_engine_contract.md §5.2
// =============================================================================

/**
 * Computes the set of active Nodes for a Flow.
 * A Node is active if it has been activated (via Entry or Gate routing)
 * and the Flow has not completed.
 *
 * INV-006: Deterministic - depends only on NodeActivation Truth
 *
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param validityEvents - All ValidityEvent records for the Flow
 * @param snapshot - The Workflow snapshot
 * @returns Set of currently active Node IDs
 */
export function computeActiveNodes(
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  validityEvents: ValidityEvent[],
  snapshot: WorkflowSnapshot
): Set<string> {
  const activeNodes = new Set<string>();
  const nodeIterations = new Map<string, number>();
  const validityMap = computeValidityMap(validityEvents);

  // Track the latest iteration for each node
  for (const activation of nodeActivations) {
    const current = nodeIterations.get(activation.nodeId) ?? 0;
    if (activation.iteration > current) {
      nodeIterations.set(activation.nodeId, activation.iteration);
    }
    activeNodes.add(activation.nodeId);
  }

  // A node is no longer active if it's complete for its current iteration
  for (const nodeId of activeNodes) {
    const iteration = nodeIterations.get(nodeId) ?? 1;
    const node = snapshot.nodes.find((n) => n.id === nodeId);
    if (node) {
      const isComplete = computeNodeComplete(
        node,
        taskExecutions,
        validityMap,
        iteration
      );
      if (isComplete) {
        activeNodes.delete(nodeId);
      }
    }
  }

  return activeNodes;
}

/**
 * Computes whether a Node is "started".
 * A Node is started when at least one of its Tasks has been started.
 *
 * Canon: 10_flowspec_engine_contract.md §5.2.2
 * INV-006: Deterministic - depends only on TaskExecution Truth
 *
 * @param node - The Node from workflow snapshot
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param iteration - The iteration to check (for cycles)
 * @returns True if the Node has started
 */
export function computeNodeStarted(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  iteration: number = 1
): boolean {
  const taskIds = new Set(node.tasks.map((t) => t.id));

  return taskExecutions.some(
    (te) =>
      taskIds.has(te.taskId) &&
      te.iteration === iteration &&
      te.startedAt !== null
  );
}

/**
 * Computes whether a Node is "complete" based on its completion rule.
 *
 * Canon: 10_flowspec_engine_contract.md §5.2.3
 * INV-006: Deterministic
 *
 * Completion Rules:
 * - ALL_TASKS_DONE: Node is done when ALL Tasks have recorded Outcomes
 * - ANY_TASK_DONE: Node is done when ANY Task has recorded an Outcome
 * - SPECIFIC_TASKS_DONE: Node is done when specified Tasks have recorded Outcomes
 *
 * DETOUR LOCK: Node completion counts only VALID outcomes.
 *
 * @param node - The Node from workflow snapshot
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param validityMap - Map of task execution IDs to their latest ValidityState
 * @param iteration - The iteration to check (for cycles)
 * @returns True if the Node is complete
 */
export function computeNodeComplete(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  validityMap: Map<string, ValidityState>,
  iteration: number = 1
): boolean {
  const taskIds = node.tasks.map((t) => t.id);

  // Get VALID outcomes for this iteration
  const validOutcomesForIteration = taskExecutions.filter(
    (te) => 
      taskIds.includes(te.taskId) && 
      te.iteration === iteration && 
      te.outcome !== null &&
      getTaskValidity(te.id, validityMap) === ValidityState.VALID
  );

  const tasksWithValidOutcomes = new Set(validOutcomesForIteration.map((te) => te.taskId));

  switch (node.completionRule) {
    case CompletionRule.ALL_TASKS_DONE:
      return taskIds.every((taskId) => tasksWithValidOutcomes.has(taskId));

    case CompletionRule.ANY_TASK_DONE:
      return tasksWithValidOutcomes.size > 0;

    case CompletionRule.SPECIFIC_TASKS_DONE:
      if (node.specificTasks.length === 0) {
        return taskIds.every((taskId) => tasksWithValidOutcomes.has(taskId));
      }
      return node.specificTasks.every((taskId) => tasksWithValidOutcomes.has(taskId));

    default:
      return taskIds.every((taskId) => tasksWithValidOutcomes.has(taskId));
  }
}

/**
 * Computes full derived state for a Node.
 *
 * @param node - The Node from workflow snapshot
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param validityEvents - All ValidityEvent records for the Flow
 * @returns DerivedNodeState
 */
export function computeNodeState(
  node: SnapshotNode,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  validityEvents: ValidityEvent[]
): DerivedNodeState {
  // Find the latest activation for this node
  const nodeActivation = nodeActivations
    .filter((na) => na.nodeId === node.id)
    .sort((a, b) => b.iteration - a.iteration)[0];

  const isActive = nodeActivation !== undefined;
  const currentIteration = nodeActivation?.iteration ?? 0;
  const validityMap = computeValidityMap(validityEvents);

  return {
    nodeId: node.id,
    isActive,
    isStarted: isActive ? computeNodeStarted(node, taskExecutions, currentIteration) : false,
    isComplete: isActive ? computeNodeComplete(node, taskExecutions, validityMap, currentIteration) : false,
    currentIteration,
  };
}

// =============================================================================
// TASK STATE COMPUTATION
// Canon: 10_flowspec_engine_contract.md §5.1, 00_flowspec_glossary.md §3.3
// =============================================================================

/**
 * Computes whether a Task is Actionable.
 *
 * A Task is Actionable when ALL of:
 * 1. The Task's containing Node is active (via Entry or Gate routing)
 * 2. All Actionability Constraints are satisfied (Cross-Flow Dependencies)
 * 3. The Task has not yet recorded a VALID Outcome for the current iteration
 *    - INVALID outcomes allow the task to re-open.
 * 4. The Node is not in the blocked scope of any ACTIVE BLOCKING detour.
 * 5. If it's a Join Node, all structural inbound parent branches are not blocked.
 *
 * Canon: 00_flowspec_glossary.md §3.3
 * INV-019: FlowSpec evaluates all Actionability
 * INV-022: Actionability constraints evaluated at Task start only
 *
 * @param task - The Task from workflow snapshot
 * @param node - The containing Node
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param detours - All DetourRecord records for the Flow
 * @param validityEvents - All ValidityEvent records for the Flow
 * @param snapshot - The Workflow snapshot
 * @param groupOutcomes - All outcomes recorded in the Flow Group (for Cross-Flow)
 * @returns True if the Task is Actionable
 */
export function computeTaskActionable(
  task: SnapshotTask,
  node: SnapshotNode,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  detours: DetourRecord[],
  validityEvents: ValidityEvent[],
  snapshot: WorkflowSnapshot,
  groupOutcomes: GroupOutcome[] = []
): boolean {
  // 1. Check if Node is active
  const nodeActivation = nodeActivations
    .filter((na) => na.nodeId === node.id)
    .sort((a, b) => b.iteration - a.iteration)[0];

  if (!nodeActivation) {
    return false; // Node not activated
  }

  const iteration = nodeActivation.iteration;
  const validityMap = computeValidityMap(validityEvents);

  // 2. Check if Node is complete (only counts VALID outcomes)
  const nodeComplete = computeNodeComplete(node, taskExecutions, validityMap, iteration);
  if (nodeComplete) {
    return false;
  }

  // 3. Check if Task has already recorded a VALID Outcome for this iteration
  // LOCK: Use the LATEST task execution for this iteration (Phase-3 re-open logic)
  const taskExecutionsForIteration = taskExecutions
    .filter((te) => te.taskId === task.id && te.iteration === iteration)
    .sort((a, b) => {
      // Sort by outcomeAt if present, then startedAt, then id as final tie-breaker
      const timeA = a.outcomeAt?.getTime() ?? a.startedAt?.getTime() ?? 0;
      const timeB = b.outcomeAt?.getTime() ?? b.startedAt?.getTime() ?? 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  
  const taskExecution = taskExecutionsForIteration[0];

  const validity = getTaskValidity(taskExecution?.id, validityMap);
  if (taskExecution?.outcome !== null && taskExecution?.outcome !== undefined) {
    // LOCK: Actionable re-open rules:
    // 1. If validity is explicitly INVALID
    // 2. If there is an ACTIVE detour at this checkpoint (allows resolution)
    const hasActiveDetourAtCheckpoint = detours.some(
      d => d.checkpointNodeId === node.id && 
           d.status === DetourStatus.ACTIVE &&
           (d.checkpointTaskExecutionId === undefined || d.checkpointTaskExecutionId === null || d.checkpointTaskExecutionId === taskExecution.id)
    );

    if (validity !== ValidityState.INVALID && !hasActiveDetourAtCheckpoint) {
      return false;
    }
  }

  // 4. Check Blocking Scope (BLOCKING Detours)
  const blockedNodes = computeBlockedNodes(detours, snapshot);
  if (blockedNodes.has(node.id)) {
    // LOCK: A blocking detour blocks its checkpoint for standard work,
    // but MUST remain actionable for the resolution task itself.
    const hasActiveDetourAtCheckpoint = detours.some(
      d => d.checkpointNodeId === node.id && d.status === DetourStatus.ACTIVE
    );
    if (!hasActiveDetourAtCheckpoint) {
      return false;
    }
  }

  // 5. Join Rule: Check structural inbound parents
  const inboundGates = snapshot.gates.filter(g => g.targetNodeId === node.id);
  // If there are inbound gates, this is a join (or at least has parents)
  for (const gate of inboundGates) {
    if (blockedNodes.has(gate.sourceNodeId)) {
      return false; // Structural parent branch is blocked
    }
  }

  // 6. Check Cross-Flow Dependencies (INV-020, INV-021)
  if (task.crossFlowDependencies && task.crossFlowDependencies.length > 0) {
    for (const dep of task.crossFlowDependencies) {
      const satisfied = groupOutcomes.some(
        (go) =>
          go.workflowId === dep.sourceWorkflowId &&
          matchesTaskPath(dep.sourceTaskPath, go.taskId) &&
          go.outcome === dep.requiredOutcome
      );
      if (!satisfied) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Helper to match a task path (e.g. "nodeId.taskId") against a taskId.
 */
function matchesTaskPath(path: string, taskId: string): boolean {
  if (path.includes(".")) {
    const parts = path.split(".");
    return parts[parts.length - 1] === taskId;
  }
  return false;
}

/**
 * Computes full derived state for a Task.
 *
 * @param task - The Task from workflow snapshot
 * @param node - The containing Node
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param detours - All DetourRecord records for the Flow
 * @param validityEvents - All ValidityEvent records for the Flow
 * @param snapshot - The Workflow snapshot
 * @param groupOutcomes - All outcomes recorded in the Flow Group
 * @returns DerivedTaskState
 */
export function computeTaskState(
  task: SnapshotTask,
  node: SnapshotNode,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  detours: DetourRecord[],
  validityEvents: ValidityEvent[],
  snapshot: WorkflowSnapshot,
  groupOutcomes: GroupOutcome[] = []
): DerivedTaskState {
  // Find the latest activation for this node
  const nodeActivation = nodeActivations
    .filter((na) => na.nodeId === node.id)
    .sort((a, b) => b.iteration - a.iteration)[0];

  const iteration = nodeActivation?.iteration ?? 1;

  // Find task execution for this iteration
  const taskExecution = taskExecutions.find(
    (te) => te.taskId === task.id && te.iteration === iteration
  );

  return {
    taskId: task.id,
    nodeId: node.id,
    isActionable: computeTaskActionable(
      task,
      node,
      nodeActivations,
      taskExecutions,
      detours,
      validityEvents,
      snapshot,
      groupOutcomes
    ),
    isStarted: taskExecution?.startedAt !== null && taskExecution?.startedAt !== undefined,
    hasOutcome: taskExecution?.outcome !== null && taskExecution?.outcome !== undefined,
    currentIteration: iteration,
    outcome: taskExecution?.outcome ?? undefined,
  };
}

/**
 * Computes all Actionable Tasks for a Flow.
 * This is the primary query interface for consumers like Work Station.
 *
 * Canon: 10_flowspec_engine_contract.md §9.1
 * INV-019: FlowSpec evaluates all Actionability
 *
 * @param snapshot - The Workflow snapshot
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param detours - All DetourRecord records for the Flow
 * @param validityEvents - All ValidityEvent records for the Flow
 * @param flowContext - Context about the Flow (ID, Group, Workflow info)
 * @param groupOutcomes - All outcomes recorded in the Flow Group
 * @returns Array of ActionableTask objects
 */
export function computeActionableTasks(
  snapshot: WorkflowSnapshot,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  detours: DetourRecord[],
  validityEvents: ValidityEvent[],
  flowContext: {
    flowId: string;
    flowGroupId: string;
    workflowId: string;
    workflowName: string;
  },
  groupOutcomes: GroupOutcome[] = []
): ActionableTask[] {
  const actionableTasks: ActionableTask[] = [];
  const validityMap = computeValidityMap(validityEvents);

  // Determine domain hint
  const domainHint: "execution" | "finance" | "sales" = 
    flowContext.workflowName.toLowerCase().includes("finance") ? "finance" :
    flowContext.workflowName.toLowerCase().includes("sales") ? "sales" : "execution";

  for (const node of snapshot.nodes) {
    // Find the latest activation for this node
    const nodeActivation = nodeActivations
      .filter((na) => na.nodeId === node.id)
      .sort((a, b) => b.iteration - a.iteration)[0];

    if (!nodeActivation) {
      continue; // Node not activated
    }

    const iteration = nodeActivation.iteration;

    // Check if node is complete
    if (computeNodeComplete(node, taskExecutions, validityMap, iteration)) {
      continue; // Node complete, no actionable tasks
    }

    for (const task of node.tasks) {
      if (
        computeTaskActionable(
          task,
          node,
          nodeActivations,
          taskExecutions,
          detours,
          validityEvents,
          snapshot,
          groupOutcomes
        )
      ) {
        // Find execution to see if started
        const execution = taskExecutions.find(
          (te) => te.taskId === task.id && te.iteration === iteration
        );

        actionableTasks.push({
          flowId: flowContext.flowId,
          flowGroupId: flowContext.flowGroupId,
          workflowId: flowContext.workflowId,
          workflowName: flowContext.workflowName,
          taskId: task.id,
          nodeId: node.id,
          taskName: task.name,
          nodeName: node.name,
          instructions: task.instructions,
          allowedOutcomes: task.outcomes.map((o) => o.name),
          evidenceRequired: task.evidenceRequired,
          evidenceSchema: task.evidenceSchema,
          iteration,
          domainHint,
          startedAt: execution?.startedAt || null,
          latestTaskExecutionId: execution?.id || null,
          metadata: task.metadata,
        });
      }
    }
  }

  // P3-T1: Canonical Sort (Fix #1)
  // 1) flowId ASC, 2) taskId ASC, 3) iteration ASC (tie-breaker)
  return actionableTasks.sort((a, b) => {
    if (a.flowId !== b.flowId) return a.flowId.localeCompare(b.flowId);
    if (a.taskId !== b.taskId) return a.taskId.localeCompare(b.taskId);
    return (a.iteration ?? 0) - (b.iteration ?? 0);
  });
}

// =============================================================================
// FLOW COMPLETION COMPUTATION
// =============================================================================

/**
 * Computes whether a Flow is complete.
 * A Flow is complete when all terminal paths have been reached.
 *
 * DETOUR LOCK: Flow cannot complete if any detour is ACTIVE.
 *
 * @param snapshot - The Workflow snapshot
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param detours - All DetourRecord records for the Flow
 * @param validityEvents - All ValidityEvent records for the Flow
 * @returns True if the Flow is complete
 */
export function computeFlowComplete(
  snapshot: WorkflowSnapshot,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  detours: DetourRecord[],
  validityEvents: ValidityEvent[]
): boolean {
  // LOCK: Any ACTIVE detour prevents completion
  const hasActiveDetours = detours.some(d => d.status === DetourStatus.ACTIVE);
  if (hasActiveDetours) {
    return false;
  }

  if (snapshot.isNonTerminating) {
    return false;
  }

  if (nodeActivations.length === 0) {
    return false;
  }

  const validityMap = computeValidityMap(validityEvents);

  // Get all nodes that have been activated
  const activatedNodeIds = new Set(nodeActivations.map((na) => na.nodeId));

  // For each activated node, check if it has completed and reached terminal
  for (const nodeId of activatedNodeIds) {
    const node = snapshot.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Get latest iteration for this node
    const latestActivation = nodeActivations
      .filter((na) => na.nodeId === nodeId)
      .sort((a, b) => b.iteration - a.iteration)[0];

    const iteration = latestActivation.iteration;

    // Check if node is complete (only counts VALID outcomes)
    if (!computeNodeComplete(node, taskExecutions, validityMap, iteration)) {
      return false;
    }

    // Node is complete - check if any outbound gates lead to another node
    const nodeOutcomes = getNodeOutcomes(node, taskExecutions, validityMap, iteration);
    const outboundGates = snapshot.gates.filter((g) => g.sourceNodeId === nodeId);

    for (const outcome of nodeOutcomes) {
      const gate = outboundGates.find((g) => g.outcomeName === outcome);
      if (gate && gate.targetNodeId !== null) {
        const targetActivated = nodeActivations.some(
          (na) => na.nodeId === gate.targetNodeId
        );
        if (!targetActivated) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Gets all outcomes recorded for a Node in a specific iteration.
 * DETOUR LOCK: Only VALID outcomes count.
 */
function getNodeOutcomes(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  validityMap: Map<string, ValidityState>,
  iteration: number
): string[] {
  const taskIds = new Set(node.tasks.map((t) => t.id));
  return taskExecutions
    .filter(
      (te) =>
        taskIds.has(te.taskId) &&
        te.iteration === iteration &&
        te.outcome !== null &&
        getTaskValidity(te.id, validityMap) === ValidityState.VALID
    )
    .map((te) => te.outcome!);
}

// =============================================================================
// GATE EVALUATION
// Canon: 10_flowspec_engine_contract.md §5.5
// =============================================================================

/**
 * Evaluates Gates for a completed Node to determine target Nodes.
 * Gates are keyed by (nodeId, outcomeName).
 *
 * Canon: 10_flowspec_engine_contract.md §5.5.3
 * INV-024: Gate key is Node-level
 *
 * @param node - The completed Node
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param validityMap - Map of task execution IDs to their latest ValidityState
 * @param gates - All Gates in the Workflow
 * @param iteration - The current iteration
 * @returns Array of GateRoutes that should be activated
 */
export function evaluateGates(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  validityMap: Map<string, ValidityState>,
  gates: SnapshotGate[],
  iteration: number
): GateRoute[] {
  // Get all unique VALID outcomes recorded for this node in this iteration
  const outcomes = getNodeOutcomes(node, taskExecutions, validityMap, iteration);
  const uniqueOutcomes = [...new Set(outcomes)];

  // Find matching gates
  const nodeGates = gates.filter((g) => g.sourceNodeId === node.id);
  const routes: GateRoute[] = [];

  for (const outcome of uniqueOutcomes) {
    const gate = nodeGates.find((g) => g.outcomeName === outcome);
    if (gate) {
      routes.push({
        gateId: gate.id,
        sourceNodeId: gate.sourceNodeId,
        outcomeName: gate.outcomeName,
        targetNodeId: gate.targetNodeId,
      });
    }
  }

  return routes;
}

// =============================================================================
// EXPLAINER CONTRACT (PURE)
// = : Phase-2 Lock 2 : exhaustive switch, no default
// =============================================================================

/**
 * Explains why an action (like starting a task or completing a flow) is refused.
 * Never returns "unknown".
 */
/** @deprecated unused */
export function explainActionRefusal(
  node: SnapshotNode,
  task: SnapshotTask,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  detours: DetourRecord[],
  validityEvents: ValidityEvent[],
  snapshot: WorkflowSnapshot,
  groupOutcomes: GroupOutcome[] = []
): ActionRefusal {
  const nodeActivation = nodeActivations
    .filter((na) => na.nodeId === node.id)
    .sort((a, b) => b.iteration - a.iteration)[0];

  if (!nodeActivation) {
    return {
      reasonCode: "NODE_NOT_ACTIVE",
      message: `Node "${node.name}" is not active.`,
    };
  }

  const iteration = nodeActivation.iteration;
  const validityMap = computeValidityMap(validityEvents);

  if (computeNodeComplete(node, taskExecutions, validityMap, iteration)) {
    return {
      reasonCode: "NODE_COMPLETE",
      message: `Node "${node.name}" is already complete.`,
    };
  }

  const taskExecution = taskExecutions.find(
    (te) => te.taskId === task.id && te.iteration === iteration
  );

  const validity = getTaskValidity(taskExecution?.id, validityMap);
  if (taskExecution?.outcome !== null && taskExecution?.outcome !== undefined) {
    if (validity !== ValidityState.INVALID) {
      return {
        reasonCode: "OUTCOME_ALREADY_RECORDED",
        message: `Task "${task.name}" already has a recorded outcome.`,
      };
    }
  }

  const blockedNodes = computeBlockedNodes(detours, snapshot);
  const activeDetour = detours.find(d => d.status === DetourStatus.ACTIVE);

  if (blockedNodes.has(node.id)) {
    const blockingDetour = detours.find(
      d => d.status === DetourStatus.ACTIVE && 
           d.type === DetourType.BLOCKING &&
           (d.checkpointNodeId === node.id || snapshot.nodes.find(n => n.id === d.checkpointNodeId)?.transitiveSuccessors.includes(node.id))
    );
    return {
      reasonCode: "ACTIVE_BLOCKING_DETOUR",
      message: `Work is paused due to an active blocking detour at "${snapshot.nodes.find(n => n.id === blockingDetour?.checkpointNodeId)?.name || 'upstream node'}".`,
    };
  }

  const inboundGates = snapshot.gates.filter(g => g.targetNodeId === node.id);
  for (const gate of inboundGates) {
    if (blockedNodes.has(gate.sourceNodeId)) {
      return {
        reasonCode: "JOIN_BLOCKED",
        message: `This join node is blocked because an inbound branch from "${snapshot.nodes.find(n => n.id === gate.sourceNodeId)?.name}" is blocked.`,
      };
    }
  }

  if (task.crossFlowDependencies && task.crossFlowDependencies.length > 0) {
    for (const dep of task.crossFlowDependencies) {
      const satisfied = groupOutcomes.some(
        (go) =>
          go.workflowId === dep.sourceWorkflowId &&
          matchesTaskPath(dep.sourceTaskPath, go.taskId) &&
          go.outcome === dep.requiredOutcome
      );
      if (!satisfied) {
        return {
          reasonCode: "CROSS_FLOW_DEP_MISSING",
          message: `Waiting for task in workflow "${dep.sourceWorkflowId}" to result in "${dep.requiredOutcome}".`,
        };
      }
    }
  }

  // If we get here but computeTaskActionable was false, it's a logic error in the engine.
  // LOCK: Throw error to catch coverage gaps in development/test.
  throw new Error(`EXPLAINER_COVERAGE_GAP: Action refused for an internal reason not yet mapped in explainer for task ${task.id} in node ${node.id}.`);
}

/**
 * Gets all Gate routes for a specific outcome in a Node.
 *
 * @param nodeId - The source Node ID
 * @param outcomeName - The outcome name
 * @param gates - All Gates in the Workflow
 * @returns The matching Gate route or undefined
 */
/** @deprecated unused */
export function getGateRoute(
  nodeId: string,
  outcomeName: string,
  gates: SnapshotGate[]
): GateRoute | undefined {
  const gate = gates.find(
    (g) => g.sourceNodeId === nodeId && g.outcomeName === outcomeName
  );

  if (!gate) {
    return undefined;
  }

  return {
    gateId: gate.id,
    sourceNodeId: gate.sourceNodeId,
    outcomeName: gate.outcomeName,
    targetNodeId: gate.targetNodeId,
  };
}
