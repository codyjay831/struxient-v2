/**
 * Zod Schema for WorkflowSnapshot Validation
 *
 * This schema validates WorkflowTemplate.definition before import.
 * It mirrors the WorkflowSnapshot interface in types.ts.
 *
 * Enforcement: Server-side parse on import; failure returns 422.
 */

import { z } from "zod";
import { CompletionRule } from "@prisma/client";

// =============================================================================
// EVIDENCE SCHEMA
// =============================================================================

const evidenceSchemaSchema = z.object({
  type: z.enum(["file", "text", "structured"]),
  // Optional fields based on type (validated at runtime if needed)
  mimeTypes: z.array(z.string()).optional(),
  maxSize: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  description: z.string().optional(),
});

// =============================================================================
// SNAPSHOT COMPONENT SCHEMAS
// =============================================================================

const snapshotCrossFlowDependencySchema = z.object({
  id: z.string(),
  sourceWorkflowId: z.string(),
  sourceTaskPath: z.string(),
  requiredOutcome: z.string(),
});

const snapshotOutcomeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

const snapshotTaskSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  instructions: z.string().nullable(),
  evidenceRequired: z.boolean(),
  evidenceSchema: evidenceSchemaSchema.nullable(),
  displayOrder: z.number(),
  outcomes: z.array(snapshotOutcomeSchema),
  crossFlowDependencies: z.array(snapshotCrossFlowDependencySchema),
});

const snapshotNodeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  isEntry: z.boolean(),
  completionRule: z.nativeEnum(CompletionRule),
  specificTasks: z.array(z.string()),
  tasks: z.array(snapshotTaskSchema),
});

const snapshotGateSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  outcomeName: z.string().min(1),
  targetNodeId: z.string().nullable(),
});

// =============================================================================
// MAIN WORKFLOW SNAPSHOT SCHEMA
// =============================================================================

export const workflowSnapshotSchema = z.object({
  workflowId: z.string(),
  version: z.number(),
  name: z.string().min(1),
  description: z.string().nullable(),
  isNonTerminating: z.boolean(),
  nodes: z.array(snapshotNodeSchema),
  gates: z.array(snapshotGateSchema),
});

export type WorkflowSnapshotInput = z.infer<typeof workflowSnapshotSchema>;

// =============================================================================
// STRUCTURAL INTEGRITY CHECKS
// These checks run after Zod parse to validate invariants.
// =============================================================================

export interface StructuralValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface StructuralValidationResult {
  valid: boolean;
  errors: StructuralValidationError[];
}

/**
 * Validate structural integrity of a parsed WorkflowSnapshot.
 * Checks invariants that cannot be expressed in Zod schema alone.
 */
export function validateSnapshotStructure(
  snapshot: WorkflowSnapshotInput
): StructuralValidationResult {
  const errors: StructuralValidationError[] = [];

  // INV-014: At least one entry node
  const entryNodes = snapshot.nodes.filter((n) => n.isEntry);
  if (entryNodes.length === 0) {
    errors.push({
      code: "NO_ENTRY_NODE",
      message: "Workflow must have at least one entry node (INV-014)",
    });
  }

  // INV-024: Gate key uniqueness (sourceNodeId, outcomeName)
  const gateKeys = new Set<string>();
  for (const gate of snapshot.gates) {
    const key = `${gate.sourceNodeId}:${gate.outcomeName}`;
    if (gateKeys.has(key)) {
      errors.push({
        code: "DUPLICATE_GATE_KEY",
        message: `Duplicate gate key (${gate.sourceNodeId}, ${gate.outcomeName}) violates INV-024`,
        path: `gates[${gate.id}]`,
      });
    }
    gateKeys.add(key);
  }

  // INV-025: Evidence schema required when evidence required
  for (const node of snapshot.nodes) {
    for (const task of node.tasks) {
      if (task.evidenceRequired && !task.evidenceSchema) {
        errors.push({
          code: "MISSING_EVIDENCE_SCHEMA",
          message: `Task "${task.name}" requires evidence but has no schema (INV-025)`,
          path: `nodes[${node.id}].tasks[${task.id}]`,
        });
      }
    }
  }

  // Reference integrity: Gate targetNodeId must exist in nodes
  const nodeIds = new Set(snapshot.nodes.map((n) => n.id));
  for (const gate of snapshot.gates) {
    if (gate.targetNodeId !== null && !nodeIds.has(gate.targetNodeId)) {
      errors.push({
        code: "INVALID_GATE_TARGET",
        message: `Gate references non-existent target node: ${gate.targetNodeId}`,
        path: `gates[${gate.id}]`,
      });
    }
    if (!nodeIds.has(gate.sourceNodeId)) {
      errors.push({
        code: "INVALID_GATE_SOURCE",
        message: `Gate references non-existent source node: ${gate.sourceNodeId}`,
        path: `gates[${gate.id}]`,
      });
    }
  }

  // Reference integrity: specificTasks must exist in parent node's tasks
  for (const node of snapshot.nodes) {
    const taskIds = new Set(node.tasks.map((t) => t.id));
    for (const taskId of node.specificTasks) {
      if (!taskIds.has(taskId)) {
        errors.push({
          code: "INVALID_SPECIFIC_TASK",
          message: `Node "${node.name}" references non-existent specific task: ${taskId}`,
          path: `nodes[${node.id}].specificTasks`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse and validate a template definition.
 * Combines Zod parsing with structural integrity checks.
 *
 * @param definition - Raw JSON from WorkflowTemplate.definition
 * @returns Parsed and validated snapshot, or throws
 */
export function parseTemplateDefinition(definition: unknown): WorkflowSnapshotInput {
  // Step 1: Zod parse (fail-closed)
  const parsed = workflowSnapshotSchema.parse(definition);

  // Step 2: Structural integrity checks
  const structuralResult = validateSnapshotStructure(parsed);
  if (!structuralResult.valid) {
    const errorMessages = structuralResult.errors.map((e) => e.message).join("; ");
    throw new Error(`Structural validation failed: ${errorMessages}`);
  }

  return parsed;
}
