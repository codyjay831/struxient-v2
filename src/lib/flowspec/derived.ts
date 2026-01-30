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

import type { NodeActivation, TaskExecution } from "@prisma/client";
import { CompletionRule } from "@prisma/client";
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
} from "./types";

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
 * @param snapshot - The Workflow snapshot
 * @returns Set of currently active Node IDs
 */
export function computeActiveNodes(
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  snapshot: WorkflowSnapshot
): Set<string> {
  const activeNodes = new Set<string>();
  const nodeIterations = new Map<string, number>();

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
 * @param node - The Node from workflow snapshot
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param iteration - The iteration to check (for cycles)
 * @returns True if the Node is complete
 */
export function computeNodeComplete(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  iteration: number = 1
): boolean {
  const taskIds = node.tasks.map((t) => t.id);

  // Get outcomes for this iteration
  const outcomesForIteration = taskExecutions.filter(
    (te) => taskIds.includes(te.taskId) && te.iteration === iteration && te.outcome !== null
  );

  const tasksWithOutcomes = new Set(outcomesForIteration.map((te) => te.taskId));

  switch (node.completionRule) {
    case CompletionRule.ALL_TASKS_DONE:
      // All tasks must have outcomes
      return taskIds.every((taskId) => tasksWithOutcomes.has(taskId));

    case CompletionRule.ANY_TASK_DONE:
      // At least one task must have an outcome
      return tasksWithOutcomes.size > 0;

    case CompletionRule.SPECIFIC_TASKS_DONE:
      // Specific tasks (from node.specificTasks) must have outcomes
      if (node.specificTasks.length === 0) {
        // If no specific tasks defined, treat as ALL_TASKS_DONE
        return taskIds.every((taskId) => tasksWithOutcomes.has(taskId));
      }
      return node.specificTasks.every((taskId) => tasksWithOutcomes.has(taskId));

    default:
      // Default to ALL_TASKS_DONE per canon
      return taskIds.every((taskId) => tasksWithOutcomes.has(taskId));
  }
}

/**
 * Computes full derived state for a Node.
 *
 * @param node - The Node from workflow snapshot
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @returns DerivedNodeState
 */
export function computeNodeState(
  node: SnapshotNode,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[]
): DerivedNodeState {
  // Find the latest activation for this node
  const nodeActivation = nodeActivations
    .filter((na) => na.nodeId === node.id)
    .sort((a, b) => b.iteration - a.iteration)[0];

  const isActive = nodeActivation !== undefined;
  const currentIteration = nodeActivation?.iteration ?? 0;

  return {
    nodeId: node.id,
    isActive,
    isStarted: isActive ? computeNodeStarted(node, taskExecutions, currentIteration) : false,
    isComplete: isActive ? computeNodeComplete(node, taskExecutions, currentIteration) : false,
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
 * 3. The Task has not yet recorded an Outcome for the current iteration
 *
 * Canon: 00_flowspec_glossary.md §3.3
 * INV-019: FlowSpec evaluates all Actionability
 * INV-022: Actionability constraints evaluated at Task start only
 *
 * @param task - The Task from workflow snapshot
 * @param node - The containing Node
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @param groupOutcomes - All outcomes recorded in the Flow Group (for Cross-Flow)
 * @returns True if the Task is Actionable
 */
export function computeTaskActionable(
  task: SnapshotTask,
  node: SnapshotNode,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
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

  // 2. Check if Node is complete (if complete, tasks are no longer actionable)
  const nodeComplete = computeNodeComplete(node, taskExecutions, iteration);
  if (nodeComplete) {
    return false;
  }

  // 3. Check if Task has already recorded an Outcome for this iteration
  const taskExecution = taskExecutions.find(
    (te) => te.taskId === task.id && te.iteration === iteration
  );

  if (taskExecution?.outcome !== null && taskExecution?.outcome !== undefined) {
    return false; // Already has outcome
  }

  // 4. Check Cross-Flow Dependencies (INV-020, INV-021)
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
 * @param groupOutcomes - All outcomes recorded in the Flow Group
 * @returns DerivedTaskState
 */
export function computeTaskState(
  task: SnapshotTask,
  node: SnapshotNode,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
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
 * @param flowContext - Context about the Flow (ID, Group, Workflow info)
 * @param groupOutcomes - All outcomes recorded in the Flow Group
 * @returns Array of ActionableTask objects
 */
export function computeActionableTasks(
  snapshot: WorkflowSnapshot,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[],
  flowContext: {
    flowId: string;
    flowGroupId: string;
    workflowId: string;
    workflowName: string;
  },
  groupOutcomes: GroupOutcome[] = []
): ActionableTask[] {
  const actionableTasks: ActionableTask[] = [];

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
    if (computeNodeComplete(node, taskExecutions, iteration)) {
      continue; // Node complete, no actionable tasks
    }

    for (const task of node.tasks) {
      if (
        computeTaskActionable(
          task,
          node,
          nodeActivations,
          taskExecutions,
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
        });
      }
    }
  }

  return actionableTasks;
}

// =============================================================================
// FLOW COMPLETION COMPUTATION
// =============================================================================

/**
 * Computes whether a Flow is complete.
 * A Flow is complete when all terminal paths have been reached.
 *
 * For a flow to be complete:
 * - All currently active paths must have reached terminal Gates (targetNodeId = null)
 * - OR the workflow is non-terminating and has explicit completion conditions
 *
 * @param snapshot - The Workflow snapshot
 * @param nodeActivations - All NodeActivation events for the Flow
 * @param taskExecutions - All TaskExecution records for the Flow
 * @returns True if the Flow is complete
 */
export function computeFlowComplete(
  snapshot: WorkflowSnapshot,
  nodeActivations: NodeActivation[],
  taskExecutions: TaskExecution[]
): boolean {
  if (snapshot.isNonTerminating) {
    // Non-terminating workflows never complete automatically
    return false;
  }

  if (nodeActivations.length === 0) {
    // No nodes activated yet - not complete
    return false;
  }

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

    // Check if node is complete
    if (!computeNodeComplete(node, taskExecutions, iteration)) {
      // Node not complete, flow not complete
      return false;
    }

    // Node is complete - check if any outbound gates lead to another node
    const nodeOutcomes = getNodeOutcomes(node, taskExecutions, iteration);
    const outboundGates = snapshot.gates.filter((g) => g.sourceNodeId === nodeId);

    for (const outcome of nodeOutcomes) {
      const gate = outboundGates.find((g) => g.outcomeName === outcome);
      if (gate && gate.targetNodeId !== null) {
        // This path leads to another node - check if that node is activated and complete
        const targetActivated = nodeActivations.some(
          (na) => na.nodeId === gate.targetNodeId
        );
        if (!targetActivated) {
          // Target not activated yet, flow not complete
          return false;
        }
      }
      // If gate.targetNodeId === null, this is a terminal path (good)
    }
  }

  return true;
}

/**
 * Gets all outcomes recorded for a Node in a specific iteration.
 */
function getNodeOutcomes(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  iteration: number
): string[] {
  const taskIds = new Set(node.tasks.map((t) => t.id));
  return taskExecutions
    .filter(
      (te) =>
        taskIds.has(te.taskId) &&
        te.iteration === iteration &&
        te.outcome !== null
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
 * @param gates - All Gates in the Workflow
 * @param iteration - The current iteration
 * @returns Array of GateRoutes that should be activated
 */
export function evaluateGates(
  node: SnapshotNode,
  taskExecutions: TaskExecution[],
  gates: SnapshotGate[],
  iteration: number
): GateRoute[] {
  // Get all unique outcomes recorded for this node in this iteration
  const outcomes = getNodeOutcomes(node, taskExecutions, iteration);
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

/**
 * Gets all Gate routes for a specific outcome in a Node.
 *
 * @param nodeId - The source Node ID
 * @param outcomeName - The outcome name
 * @param gates - All Gates in the Workflow
 * @returns The matching Gate route or undefined
 */
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
