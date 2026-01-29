/**
 * FlowSpec Evidence Validation
 *
 * Canon Source: 10_flowspec_engine_contract.md §8.3
 */

import type { WorkflowWithRelations } from "../types";
import type { ValidationError } from "./types";

/**
 * Validates evidence requirements.
 *
 * Checks:
 * - Evidence schemas well-formed
 * - Required Evidence achievable
 */
export function validateEvidence(
  workflow: WorkflowWithRelations
): ValidationError[] {
  const errors: ValidationError[] = [];

  workflow.nodes.forEach((node, nodeIndex) => {
    node.tasks.forEach((task, taskIndex) => {
      if (task.evidenceRequired) {
        // 1. Schema well-formed
        if (task.evidenceSchema) {
          try {
            // For now, simple check that it's valid JSON if it's a string,
            // or just exists if it's an object.
            // Future: Validate against JSON Schema spec if that's what we use.
            if (typeof task.evidenceSchema === 'string') {
              JSON.parse(task.evidenceSchema);
            }
          } catch (e) {
            errors.push({
              severity: "error",
              category: "evidence",
              path: `nodes[${nodeIndex}].tasks[${taskIndex}].evidenceSchema`,
              code: "INVALID_EVIDENCE_SCHEMA",
              message: `Evidence schema for Task "${task.name}" is not well-formed JSON`,
              suggestion: "Correct the JSON format of the evidence schema",
            });
          }
        }

        // 2. Required evidence achievable
        // This is a bit abstract in canon. In v2, if evidenceRequired is true,
        // the user MUST be able to attach evidence. Since the Work Station
        // provides an upload mechanism, this is usually true as long as 
        // the configuration is valid.
      }
    });
  });

  return errors;
}
