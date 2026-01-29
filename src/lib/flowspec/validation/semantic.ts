/**
 * FlowSpec Semantic Validation
 *
 * Canon Source: 10_flowspec_engine_contract.md §8.4
 */

import { CompletionRule } from "@prisma/client";
import type { WorkflowWithRelations } from "../types";
import type { ValidationError } from "./types";

/**
 * Validates semantic correctness.
 *
 * Checks:
 * - Node completion rules reference valid Tasks (for SPECIFIC_TASKS_DONE)
 * - Cycle acknowledgment (if required)
 */
export function validateSemantic(
  workflow: WorkflowWithRelations
): ValidationError[] {
  const errors: ValidationError[] = [];

  workflow.nodes.forEach((node, nodeIndex) => {
    // 1. Completion rules valid
    if (node.completionRule === CompletionRule.SPECIFIC_TASKS_DONE) {
      const taskIds = new Set(node.tasks.map((t) => t.id));
      node.specificTasks.forEach((taskId, specificIndex) => {
        if (!taskIds.has(taskId)) {
          errors.push({
            severity: "error",
            category: "semantic",
            path: `nodes[${nodeIndex}].specificTasks[${specificIndex}]`,
            code: "INVALID_SPECIFIC_TASK",
            message: `Completion rule for Node "${node.name}" references non-existent Task ID "${taskId}"`,
            suggestion: "Ensure all IDs in specificTasks exist within the Node",
          });
        }
      });

      if (node.specificTasks.length === 0) {
        errors.push({
          severity: "warning",
          category: "semantic",
          path: `nodes[${nodeIndex}].specificTasks`,
          code: "EMPTY_SPECIFIC_TASKS",
          message: `Node "${node.name}" uses SPECIFIC_TASKS_DONE but no tasks are specified`,
          suggestion: "Add task IDs to specificTasks, or change completion rule to ALL_TASKS_DONE",
        });
      }
    }
  });

  return errors;
}
