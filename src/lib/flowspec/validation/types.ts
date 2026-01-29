/**
 * FlowSpec Validation Types
 *
 * Canon Source: 40_flowspec_builder_contract.md §7.3
 */

export type ValidationErrorSeverity = "error" | "warning";

export type ValidationErrorCategory =
  | "structural"
  | "outcome_gate"
  | "evidence"
  | "semantic"
  | "cross_flow"
  | "fan_out";

export interface ValidationError {
  severity: ValidationErrorSeverity;
  category: ValidationErrorCategory;
  path: string; // e.g., "nodes[0].tasks[2].outcomes"
  code: string; // e.g., "NO_ENTRY_NODE"
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
