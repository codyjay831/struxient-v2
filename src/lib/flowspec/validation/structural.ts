/**
 * FlowSpec Structural Validation
 *
 * Canon Source: 10_flowspec_engine_contract.md §8.1
 */

import type { WorkflowWithRelations, SnapshotNode } from "../types";
import type { ValidationError } from "./types";

/**
 * Validates the structural integrity of a workflow.
 *
 * Checks:
 * - Entry Node exists (at least one)
 * - All Nodes reachable from Entry Node(s)
 * - All Tasks are within Nodes (orphan tasks)
 * - Terminal path exists (or explicit non-terminating)
 */
export function validateStructural(
  workflow: WorkflowWithRelations
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Entry Node exists
  const entryNodes = workflow.nodes.filter((n) => n.isEntry);
  if (entryNodes.length === 0) {
    errors.push({
      severity: "error",
      category: "structural",
      path: "nodes",
      code: "NO_ENTRY_NODE",
      message: "No Node is marked as an entry point",
      suggestion: "Mark at least one Node as Entry Node",
    });
  }

  // 2. Reachability
  const visited = new Set<string>();
  const queue = entryNodes.map((n) => n.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const nodeGates = workflow.gates.filter((g) => g.sourceNodeId === nodeId);
    for (const gate of nodeGates) {
      if (gate.targetNodeId && !visited.has(gate.targetNodeId)) {
        queue.push(gate.targetNodeId);
      }
    }
  }

  workflow.nodes.forEach((node, index) => {
    if (!visited.has(node.id)) {
      errors.push({
        severity: "error",
        category: "structural",
        path: `nodes[${index}]`,
        code: "UNREACHABLE_NODE",
        message: `Node "${node.name}" is not reachable from any Entry Node`,
        suggestion: "Add a Gate route leading to this Node",
      });
    }
  });

  // 3. Orphan Tasks - Prisma schema ensures tasks belong to a node,
  // but we should verify the workflow relation is consistent.
  // (In-memory objects might have tasks without nodeId)
  workflow.nodes.forEach((node, nodeIndex) => {
    node.tasks.forEach((task, taskIndex) => {
      if (!task.nodeId || task.nodeId !== node.id) {
        errors.push({
          severity: "error",
          category: "structural",
          path: `nodes[${nodeIndex}].tasks[${taskIndex}]`,
          code: "ORPHAN_TASK",
          message: `Task "${task.name}" is not correctly associated with Node "${node.name}"`,
          suggestion: "Re-associate task with node",
        });
      }
    });
  });

  // 4. Terminal Path Exists
  if (!workflow.isNonTerminating) {
    const hasTerminalPath = checkTerminalPath(workflow, entryNodes.map(n => n.id));
    if (!hasTerminalPath && workflow.nodes.length > 0) {
      errors.push({
        severity: "error",
        category: "structural",
        path: "gates",
        code: "NO_TERMINAL_PATH",
        message: "Workflow has no path that leads to termination",
        suggestion: "Add a Gate with no target (null target) to mark a terminal path, or mark workflow as non-terminating",
      });
    }
  }

  return errors;
}

/**
 * Checks if at least one terminal path exists in the workflow.
 */
function checkTerminalPath(
  workflow: WorkflowWithRelations,
  startNodeIds: string[]
): boolean {
  const visited = new Set<string>();
  const stack = [...startNodeIds];

  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const nodeGates = workflow.gates.filter((g) => g.sourceNodeId === nodeId);
    
    // If a node has no gates, and it's reachable, does it count as terminal?
    // Canon says Gates route. If no gates exist for a node, its outcomes are orphaned.
    // INV-008: All Outcomes Must Have Routes.
    // So a terminal path MUST be an explicit Gate with targetNodeId = null.
    
    for (const gate of nodeGates) {
      if (gate.targetNodeId === null) {
        return true; // Found a terminal path
      }
      if (!visited.has(gate.targetNodeId)) {
        stack.push(gate.targetNodeId);
      }
    }
  }

  return false;
}
