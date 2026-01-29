/**
 * FlowSpec Validation Entry Point
 *
 * Canon Source: 10_flowspec_engine_contract.md §8
 */

import type { WorkflowWithRelations } from "../types";
import type { ValidationResult, ValidationError } from "./types";
import { validateStructural } from "./structural";
import { validateOutcomesAndGates } from "./outcomes";
import { validateEvidence } from "./evidence";
import { validateSemantic } from "./semantic";
import { validateCrossFlow } from "./cross-flow";
import { validateFanOut } from "./fan-out";

export * from "./types";

/**
 * Performs comprehensive validation on a workflow specification.
 *
 * @param workflow - The workflow to validate
 * @returns ValidationResult containing any errors found
 */
export async function validateWorkflow(
  workflow: WorkflowWithRelations
): Promise<ValidationResult> {
  const errors: ValidationError[] = [
    ...validateStructural(workflow),
    ...validateOutcomesAndGates(workflow),
    ...validateEvidence(workflow),
    ...validateSemantic(workflow),
    ...(await validateCrossFlow(workflow)),
    ...(await validateFanOut(workflow)),
  ];

  return {
    valid: errors.length === 0,
    errors,
  };
}
