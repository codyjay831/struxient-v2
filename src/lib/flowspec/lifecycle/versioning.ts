/**
 * FlowSpec Workflow Versioning and Snapshotting
 *
 * Canon Source: 10_flowspec_engine_contract.md §7.3, 20_flowspec_invariants.md INV-011
 */

import type { WorkflowWithRelations, WorkflowSnapshot } from "../types";

/**
 * Creates an immutable snapshot of a workflow's current structure.
 * This snapshot is stored in the WorkflowVersion record.
 *
 * INV-011: Published workflows are immutable (via snapshot)
 *
 * @param workflow - The workflow with all nodes, tasks, outcomes, and gates loaded
 * @returns A WorkflowSnapshot object
 */
export function createWorkflowSnapshot(
  workflow: WorkflowWithRelations
): WorkflowSnapshot {
  return {
    workflowId: workflow.id,
    version: workflow.version,
    name: workflow.name,
    description: workflow.description,
    isNonTerminating: workflow.isNonTerminating,
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      isEntry: node.isEntry,
      nodeKind: node.nodeKind,
      completionRule: node.completionRule,
      specificTasks: node.specificTasks,
      tasks: node.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        instructions: task.instructions,
        evidenceRequired: task.evidenceRequired,
        evidenceSchema: task.evidenceSchema,
        displayOrder: task.displayOrder,
        defaultSlaHours: task.defaultSlaHours ?? null,
        outcomes: task.outcomes.map((outcome) => ({
          id: outcome.id,
          name: outcome.name,
        })),
        crossFlowDependencies: task.crossFlowDependencies.map((dep) => ({
          id: dep.id,
          sourceWorkflowId: dep.sourceWorkflowId,
          sourceTaskPath: dep.sourceTaskPath,
          requiredOutcome: dep.requiredOutcome,
        })),
      })),
      transitiveSuccessors: computeTransitiveSuccessors(node.id, workflow.gates),
    })),
    gates: workflow.gates.map((gate) => ({
      id: gate.id,
      sourceNodeId: gate.sourceNodeId,
      outcomeName: gate.outcomeName,
      targetNodeId: gate.targetNodeId,
    })),
  };
}

/**
 * Computes all nodes reachable from a given node by following gates.
 * Handles cycles and uses BFS for deterministic discovery.
 *
 * @param nodeId - The starting node ID
 * @param gates - All gates in the workflow
 * @returns Sorted array of reachable node IDs
 */
function computeTransitiveSuccessors(
  nodeId: string,
  gates: { sourceNodeId: string; targetNodeId: string | null }[]
): string[] {
  const successors = new Set<string>();
  const queue = [nodeId];
  const visited = new Set<string>([nodeId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const outboundGates = gates.filter((g) => g.sourceNodeId === currentId);

    for (const gate of outboundGates) {
      if (gate.targetNodeId && !visited.has(gate.targetNodeId)) {
        visited.add(gate.targetNodeId);
        successors.add(gate.targetNodeId);
        queue.push(gate.targetNodeId);
      }
    }
  }

  // Deterministic sort for snapshot stability
  return Array.from(successors).sort();
}
