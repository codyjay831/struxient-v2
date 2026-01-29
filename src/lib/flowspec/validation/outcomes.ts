/**
 * FlowSpec Outcome and Gate Validation
 *
 * Canon Source: 10_flowspec_engine_contract.md §8.2
 */

import type { WorkflowWithRelations } from "../types";
import type { ValidationError } from "./types";

/**
 * Validates outcomes and gates.
 *
 * Checks:
 * - All Tasks have at least one defined Outcome
 * - All Outcomes have Gate routes defined
 * - No orphaned Outcomes (defined but never routed)
 * - All Gate targets reference existing Nodes
 * - No conflicting routes for same outcome name within a Node
 */
export function validateOutcomesAndGates(
  workflow: WorkflowWithRelations
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  workflow.nodes.forEach((node, nodeIndex) => {
    const nodeOutcomeRoutes = new Map<string, string | null>(); // outcomeName -> targetNodeId

    // 3. Check for conflicting gate records (multiple gates for same outcome in same node)
    const nodeGates = workflow.gates.filter((g) => g.sourceNodeId === node.id);
    const seenOutcomes = new Map<string, string | null>(); // outcomeName -> targetNodeId

    nodeGates.forEach((gate, gateIndex) => {
      if (seenOutcomes.has(gate.outcomeName)) {
        const existingTarget = seenOutcomes.get(gate.outcomeName);
        if (existingTarget !== gate.targetNodeId) {
          errors.push({
            severity: "error",
            category: "outcome_gate",
            path: `nodes[${nodeIndex}].gates[${gateIndex}]`,
            code: "CONFLICTING_GATE_ROUTES",
            message: `Conflicting routes for outcome "${gate.outcomeName}" in Node "${node.name}": multiple Gates define different target Nodes.`,
            suggestion: "Ensure only one Gate exists per outcome name in a Node, or that all Gates for the same outcome point to the same target",
          });
        }
      } else {
        seenOutcomes.set(gate.outcomeName, gate.targetNodeId);
      }

      // 4. All Gate targets exist
      if (gate.targetNodeId !== null && !nodeIds.has(gate.targetNodeId)) {
        errors.push({
          severity: "error",
          category: "outcome_gate",
          path: `nodes[${nodeIndex}].gates[${gateIndex}]`,
          code: "INVALID_GATE_TARGET",
          message: `Gate for outcome "${gate.outcomeName}" routes to non-existent Node ID "${gate.targetNodeId}"`,
          suggestion: "Update the Gate to point to a valid Node, or set to terminal (null)",
        });
      }
    });

    node.tasks.forEach((task, taskIndex) => {
      // 1. All Tasks have Outcomes
      if (task.outcomes.length === 0) {
        errors.push({
          severity: "error",
          category: "outcome_gate",
          path: `nodes[${nodeIndex}].tasks[${taskIndex}]`,
          code: "NO_OUTCOMES_DEFINED",
          message: `Task "${task.name}" has no defined outcomes`,
          suggestion: "Add at least one outcome to this task",
        });
      }

      task.outcomes.forEach((outcome) => {
        // 2. All Outcomes have routes
        const gate = nodeGates.find((g) => g.outcomeName === outcome.name);

        if (!gate) {
          errors.push({
            severity: "error",
            category: "outcome_gate",
            path: `nodes[${nodeIndex}].tasks[${taskIndex}].outcomes[${outcome.name}]`,
            code: "ORPHANED_OUTCOME",
            message: `Outcome "${outcome.name}" on Task "${task.name}" has no defined Gate route`,
            suggestion: "Add a Gate route for this outcome",
          });
        }
      });
    });
  });

  return errors;
}
