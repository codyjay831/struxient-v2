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
      completionRule: node.completionRule,
      specificTasks: node.specificTasks,
      tasks: node.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        instructions: task.instructions,
        evidenceRequired: task.evidenceRequired,
        evidenceSchema: task.evidenceSchema,
        displayOrder: task.displayOrder,
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
    })),
    gates: workflow.gates.map((gate) => ({
      id: gate.id,
      sourceNodeId: gate.sourceNodeId,
      outcomeName: gate.outcomeName,
      targetNodeId: gate.targetNodeId,
    })),
  };
}
