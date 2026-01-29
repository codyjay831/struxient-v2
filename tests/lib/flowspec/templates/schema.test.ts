/**
 * Fixture Tests for WorkflowSnapshot Schema Validation
 *
 * Tests:
 * 1. Minimal valid snapshot
 * 2. Snapshot with evidenceRequired true (valid and invalid)
 * 3. Gate uniqueness edge case (duplicate gate keys)
 */

import { describe, it, expect } from "vitest";
import {
  workflowSnapshotSchema,
  validateSnapshotStructure,
  parseTemplateDefinition,
  type WorkflowSnapshotInput,
} from "@/lib/flowspec/templates/schema";
import { ZodError } from "zod";

// =============================================================================
// FIXTURES
// =============================================================================

/**
 * Minimal valid snapshot: 1 entry node, 1 task, 1 outcome, 1 terminal gate
 */
const minimalValidSnapshot: WorkflowSnapshotInput = {
  workflowId: "wf-001",
  version: 1,
  name: "Minimal Workflow",
  description: null,
  isNonTerminating: false,
  nodes: [
    {
      id: "node-1",
      name: "Entry Node",
      isEntry: true,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      tasks: [
        {
          id: "task-1",
          name: "First Task",
          instructions: null,
          evidenceRequired: false,
          evidenceSchema: null,
          displayOrder: 0,
          outcomes: [{ id: "outcome-1", name: "DONE" }],
          crossFlowDependencies: [],
        },
      ],
    },
  ],
  gates: [
    {
      id: "gate-1",
      sourceNodeId: "node-1",
      outcomeName: "DONE",
      targetNodeId: null, // Terminal
    },
  ],
};

/**
 * Snapshot with evidenceRequired and valid schema
 */
const snapshotWithEvidence: WorkflowSnapshotInput = {
  ...minimalValidSnapshot,
  workflowId: "wf-002",
  name: "Workflow With Evidence",
  nodes: [
    {
      id: "node-1",
      name: "Entry Node",
      isEntry: true,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      tasks: [
        {
          id: "task-1",
          name: "Upload Task",
          instructions: "Upload required documentation",
          evidenceRequired: true,
          evidenceSchema: {
            type: "file",
            mimeTypes: ["application/pdf", "image/jpeg"],
            maxSize: 10485760,
            description: "Upload contract document",
          },
          displayOrder: 0,
          outcomes: [{ id: "outcome-1", name: "UPLOADED" }],
          crossFlowDependencies: [],
        },
      ],
    },
  ],
};

/**
 * Invalid: evidenceRequired true but evidenceSchema is null (INV-025 violation)
 */
const invalidEvidenceSnapshot = {
  ...minimalValidSnapshot,
  workflowId: "wf-003",
  name: "Invalid Evidence Workflow",
  nodes: [
    {
      id: "node-1",
      name: "Entry Node",
      isEntry: true,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      tasks: [
        {
          id: "task-1",
          name: "Upload Task",
          instructions: null,
          evidenceRequired: true,
          evidenceSchema: null, // INVALID: required but no schema
          displayOrder: 0,
          outcomes: [{ id: "outcome-1", name: "DONE" }],
          crossFlowDependencies: [],
        },
      ],
    },
  ],
};

/**
 * Invalid: Duplicate gate keys (same sourceNodeId + outcomeName) - INV-024 violation
 */
const duplicateGateKeysSnapshot = {
  ...minimalValidSnapshot,
  workflowId: "wf-004",
  name: "Duplicate Gate Keys Workflow",
  nodes: [
    {
      id: "node-1",
      name: "Entry Node",
      isEntry: true,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      tasks: [
        {
          id: "task-1",
          name: "First Task",
          instructions: null,
          evidenceRequired: false,
          evidenceSchema: null,
          displayOrder: 0,
          outcomes: [{ id: "outcome-1", name: "DONE" }],
          crossFlowDependencies: [],
        },
      ],
    },
    {
      id: "node-2",
      name: "Target Node",
      isEntry: false,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      tasks: [
        {
          id: "task-2",
          name: "Second Task",
          instructions: null,
          evidenceRequired: false,
          evidenceSchema: null,
          displayOrder: 0,
          outcomes: [{ id: "outcome-2", name: "COMPLETED" }],
          crossFlowDependencies: [],
        },
      ],
    },
  ],
  gates: [
    {
      id: "gate-1",
      sourceNodeId: "node-1",
      outcomeName: "DONE",
      targetNodeId: "node-2",
    },
    {
      id: "gate-2",
      sourceNodeId: "node-1",
      outcomeName: "DONE", // DUPLICATE KEY: same (node-1, DONE)
      targetNodeId: null,
    },
  ],
};

/**
 * Invalid: No entry node (INV-014 violation)
 */
const noEntryNodeSnapshot = {
  ...minimalValidSnapshot,
  workflowId: "wf-005",
  name: "No Entry Node Workflow",
  nodes: [
    {
      ...minimalValidSnapshot.nodes[0],
      isEntry: false, // No entry node
    },
  ],
};

/**
 * Invalid: Gate references non-existent node
 */
const invalidGateTargetSnapshot = {
  ...minimalValidSnapshot,
  workflowId: "wf-006",
  name: "Invalid Gate Target Workflow",
  gates: [
    {
      id: "gate-1",
      sourceNodeId: "node-1",
      outcomeName: "DONE",
      targetNodeId: "non-existent-node", // Invalid reference
    },
  ],
};

// =============================================================================
// TESTS
// =============================================================================

describe("WorkflowSnapshot Schema Validation", () => {
  describe("Zod Schema Parsing", () => {
    it("accepts minimal valid snapshot", () => {
      const result = workflowSnapshotSchema.safeParse(minimalValidSnapshot);
      expect(result.success).toBe(true);
    });

    it("accepts snapshot with valid evidence schema", () => {
      const result = workflowSnapshotSchema.safeParse(snapshotWithEvidence);
      expect(result.success).toBe(true);
    });

    it("rejects snapshot with missing required fields", () => {
      const invalid = { name: "Missing Fields" };
      const result = workflowSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects snapshot with invalid evidence schema type", () => {
      const invalid = {
        ...snapshotWithEvidence,
        nodes: [
          {
            ...snapshotWithEvidence.nodes[0],
            tasks: [
              {
                ...snapshotWithEvidence.nodes[0].tasks[0],
                evidenceSchema: {
                  type: "invalid_type", // Not file/text/structured
                },
              },
            ],
          },
        ],
      };
      const result = workflowSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Structural Integrity Validation", () => {
    it("passes minimal valid snapshot", () => {
      const result = validateSnapshotStructure(minimalValidSnapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes snapshot with valid evidence schema", () => {
      const result = validateSnapshotStructure(snapshotWithEvidence);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails on evidenceRequired with null schema (INV-025)", () => {
      const parsed = workflowSnapshotSchema.parse(invalidEvidenceSnapshot);
      const result = validateSnapshotStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MISSING_EVIDENCE_SCHEMA")).toBe(true);
    });

    it("fails on duplicate gate keys (INV-024)", () => {
      const parsed = workflowSnapshotSchema.parse(duplicateGateKeysSnapshot);
      const result = validateSnapshotStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "DUPLICATE_GATE_KEY")).toBe(true);
    });

    it("fails on no entry node (INV-014)", () => {
      const parsed = workflowSnapshotSchema.parse(noEntryNodeSnapshot);
      const result = validateSnapshotStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "NO_ENTRY_NODE")).toBe(true);
    });

    it("fails on invalid gate target reference", () => {
      const parsed = workflowSnapshotSchema.parse(invalidGateTargetSnapshot);
      const result = validateSnapshotStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_GATE_TARGET")).toBe(true);
    });
  });

  describe("parseTemplateDefinition (Combined Validation)", () => {
    it("returns parsed snapshot for valid input", () => {
      const result = parseTemplateDefinition(minimalValidSnapshot);
      expect(result.name).toBe("Minimal Workflow");
      expect(result.nodes).toHaveLength(1);
    });

    it("throws ZodError for malformed input", () => {
      expect(() => parseTemplateDefinition({ invalid: true })).toThrow(ZodError);
    });

    it("throws Error for structurally invalid input (INV-025)", () => {
      expect(() => parseTemplateDefinition(invalidEvidenceSnapshot)).toThrow(
        /Structural validation failed/
      );
    });

    it("throws Error for structurally invalid input (INV-024)", () => {
      expect(() => parseTemplateDefinition(duplicateGateKeysSnapshot)).toThrow(
        /Structural validation failed/
      );
    });
  });
});

describe("Fixture Uniqueness Assertions", () => {
  it("minimal fixture has unique node names", () => {
    const nodeNames = minimalValidSnapshot.nodes.map((n) => n.name);
    expect(new Set(nodeNames).size).toBe(nodeNames.length);
  });

  it("minimal fixture has unique task names within each node", () => {
    for (const node of minimalValidSnapshot.nodes) {
      const taskNames = node.tasks.map((t) => t.name);
      expect(new Set(taskNames).size).toBe(taskNames.length);
    }
  });

  it("snapshot with evidence has unique node names", () => {
    const nodeNames = snapshotWithEvidence.nodes.map((n) => n.name);
    expect(new Set(nodeNames).size).toBe(nodeNames.length);
  });
});
