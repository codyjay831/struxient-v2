/**
 * FlowGroup Policy Tests
 *
 * Tests for Policy Contract v1.0:
 * - Merge precedence (B > A > null)
 * - Task override validation
 * - Signal computation determinism
 * - Canonical ordering preservation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  mergeSlaPrecedence,
  computeTaskSignals,
  validateTaskOverrides,
  validateJobPriority,
  getSnapshotTaskIds,
} from "@/lib/flowspec/policy";
import type { EffectivePolicy } from "@/lib/flowspec/policy";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createSnapshot = (tasks: { id: string; defaultSlaHours: number | null }[]): WorkflowSnapshot => ({
  workflowId: "wf-1",
  version: 1,
  name: "Test Workflow",
  description: null,
  isNonTerminating: false,
  nodes: [
    {
      id: "node-1",
      name: "Node 1",
      isEntry: true,
      completionRule: "ALL_TASKS_DONE",
      specificTasks: [],
      transitiveSuccessors: [],
      tasks: tasks.map((t) => ({
        id: t.id,
        name: `Task ${t.id}`,
        instructions: null,
        evidenceRequired: false,
        evidenceSchema: null,
        displayOrder: 0,
        defaultSlaHours: t.defaultSlaHours,
        outcomes: [{ id: "out-1", name: "DONE" }],
        crossFlowDependencies: [],
      })),
    },
  ],
  gates: [],
});

const createEffectivePolicy = (
  jobPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT",
  taskPolicies: Map<string, { taskId: string; effectiveSlaHours: number | null; defaultSlaHours: number | null; overrideSlaHours: number | null }>
): EffectivePolicy => ({
  flowGroupId: "fg-1",
  jobPriority,
  groupDueAt: null,
  taskPolicies,
});

// =============================================================================
// MERGE PRECEDENCE TESTS (B > A > null)
// =============================================================================

describe("mergeSlaPrecedence", () => {
  it("returns override (B) when both A and B are present", () => {
    // B = 8 hours override, A = 24 hours default
    const result = mergeSlaPrecedence(8, 24);
    expect(result).toBe(8);
  });

  it("returns default (A) when override (B) is null", () => {
    const result = mergeSlaPrecedence(null, 24);
    expect(result).toBe(24);
  });

  it("returns default (A) when override (B) is undefined", () => {
    const result = mergeSlaPrecedence(undefined, 24);
    expect(result).toBe(24);
  });

  it("returns override (B) when default (A) is null", () => {
    const result = mergeSlaPrecedence(4, null);
    expect(result).toBe(4);
  });

  it("returns null when both are null", () => {
    const result = mergeSlaPrecedence(null, null);
    expect(result).toBeNull();
  });

  it("returns null when both are undefined", () => {
    const result = mergeSlaPrecedence(undefined, undefined);
    expect(result).toBeNull();
  });

  it("returns override (B) with value 0 (zero is valid)", () => {
    const result = mergeSlaPrecedence(0, 24);
    expect(result).toBe(0);
  });
});

// =============================================================================
// TASK OVERRIDE VALIDATION TESTS
// =============================================================================

describe("validateTaskOverrides", () => {
  const snapshot = createSnapshot([
    { id: "task-1", defaultSlaHours: 24 },
    { id: "task-2", defaultSlaHours: null },
  ]);

  it("validates when all taskIds exist in snapshot", () => {
    const overrides = [
      { taskId: "task-1", slaHours: 8 },
      { taskId: "task-2", slaHours: 4 },
    ];
    const result = validateTaskOverrides(overrides, snapshot);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when taskId does not exist in snapshot", () => {
    const overrides = [
      { taskId: "task-1", slaHours: 8 },
      { taskId: "task-nonexistent", slaHours: 4 },
    ];
    const result = validateTaskOverrides(overrides, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Task ID "task-nonexistent" does not exist in the bound workflow version');
  });

  it("fails when slaHours is negative", () => {
    const overrides = [{ taskId: "task-1", slaHours: -5 }];
    const result = validateTaskOverrides(overrides, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('SLA hours for task "task-1" cannot be negative');
  });

  it("allows slaHours of 0", () => {
    const overrides = [{ taskId: "task-1", slaHours: 0 }];
    const result = validateTaskOverrides(overrides, snapshot);
    expect(result.valid).toBe(true);
  });

  it("allows slaHours of null", () => {
    const overrides = [{ taskId: "task-1", slaHours: null }];
    const result = validateTaskOverrides(overrides, snapshot);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// JOB PRIORITY VALIDATION TESTS
// =============================================================================

describe("validateJobPriority", () => {
  it("accepts LOW", () => expect(validateJobPriority("LOW")).toBe(true));
  it("accepts NORMAL", () => expect(validateJobPriority("NORMAL")).toBe(true));
  it("accepts HIGH", () => expect(validateJobPriority("HIGH")).toBe(true));
  it("accepts URGENT", () => expect(validateJobPriority("URGENT")).toBe(true));
  it("rejects invalid value", () => expect(validateJobPriority("CRITICAL")).toBe(false));
  it("rejects lowercase", () => expect(validateJobPriority("high")).toBe(false));
  it("rejects empty string", () => expect(validateJobPriority("")).toBe(false));
});

// =============================================================================
// SIGNAL COMPUTATION TESTS
// =============================================================================

describe("computeTaskSignals", () => {
  it("computes effectiveDueAt deterministically from activatedAt + slaHours", () => {
    const taskPolicies = new Map([
      ["task-1", { taskId: "task-1", effectiveSlaHours: 24, defaultSlaHours: 24, overrideSlaHours: null }],
    ]);
    const policy = createEffectivePolicy("NORMAL", taskPolicies);
    
    const activatedAt = new Date("2026-02-01T10:00:00Z");
    const asOf = new Date("2026-02-01T12:00:00Z");
    
    const signals = computeTaskSignals(policy, "task-1", activatedAt, asOf);
    
    expect(signals.effectiveSlaHours).toBe(24);
    expect(signals.effectiveDueAt).toEqual(new Date("2026-02-02T10:00:00Z"));
    expect(signals.isOverdue).toBe(false);
    expect(signals.isDueSoon).toBe(true); // Within 24 hours
  });

  it("marks task as overdue when dueAt < asOf", () => {
    const taskPolicies = new Map([
      ["task-1", { taskId: "task-1", effectiveSlaHours: 2, defaultSlaHours: 2, overrideSlaHours: null }],
    ]);
    const policy = createEffectivePolicy("NORMAL", taskPolicies);
    
    const activatedAt = new Date("2026-02-01T10:00:00Z");
    const asOf = new Date("2026-02-01T15:00:00Z"); // 5 hours later, SLA was 2 hours
    
    const signals = computeTaskSignals(policy, "task-1", activatedAt, asOf);
    
    expect(signals.isOverdue).toBe(true);
    expect(signals.isDueSoon).toBe(false);
  });

  it("returns null dueAt when no effectiveSlaHours", () => {
    const taskPolicies = new Map([
      ["task-1", { taskId: "task-1", effectiveSlaHours: null, defaultSlaHours: null, overrideSlaHours: null }],
    ]);
    const policy = createEffectivePolicy("HIGH", taskPolicies);
    
    const activatedAt = new Date("2026-02-01T10:00:00Z");
    const signals = computeTaskSignals(policy, "task-1", activatedAt);
    
    expect(signals.effectiveSlaHours).toBeNull();
    expect(signals.effectiveDueAt).toBeNull();
    expect(signals.isOverdue).toBe(false);
    expect(signals.isDueSoon).toBe(false);
  });

  it("returns null dueAt when activatedAt is null", () => {
    const taskPolicies = new Map([
      ["task-1", { taskId: "task-1", effectiveSlaHours: 24, defaultSlaHours: 24, overrideSlaHours: null }],
    ]);
    const policy = createEffectivePolicy("NORMAL", taskPolicies);
    
    const signals = computeTaskSignals(policy, "task-1", null);
    
    expect(signals.effectiveDueAt).toBeNull();
    expect(signals.isOverdue).toBe(false);
  });

  it("propagates jobPriority from policy", () => {
    const taskPolicies = new Map([
      ["task-1", { taskId: "task-1", effectiveSlaHours: null, defaultSlaHours: null, overrideSlaHours: null }],
    ]);
    const policy = createEffectivePolicy("URGENT", taskPolicies);
    
    const signals = computeTaskSignals(policy, "task-1", null);
    
    expect(signals.jobPriority).toBe("URGENT");
  });

  it("same inputs produce same output (determinism)", () => {
    const taskPolicies = new Map([
      ["task-1", { taskId: "task-1", effectiveSlaHours: 8, defaultSlaHours: 8, overrideSlaHours: null }],
    ]);
    const policy = createEffectivePolicy("HIGH", taskPolicies);
    
    const activatedAt = new Date("2026-02-01T10:00:00Z");
    const asOf = new Date("2026-02-01T12:00:00Z");
    
    const signals1 = computeTaskSignals(policy, "task-1", activatedAt, asOf);
    const signals2 = computeTaskSignals(policy, "task-1", activatedAt, asOf);
    
    expect(signals1).toEqual(signals2);
  });
});

// =============================================================================
// SNAPSHOT TASK ID EXTRACTION TESTS
// =============================================================================

describe("getSnapshotTaskIds", () => {
  it("extracts all task IDs from snapshot", () => {
    const snapshot = createSnapshot([
      { id: "task-1", defaultSlaHours: 24 },
      { id: "task-2", defaultSlaHours: null },
      { id: "task-3", defaultSlaHours: 8 },
    ]);
    
    const taskIds = getSnapshotTaskIds(snapshot);
    
    expect(taskIds.size).toBe(3);
    expect(taskIds.has("task-1")).toBe(true);
    expect(taskIds.has("task-2")).toBe(true);
    expect(taskIds.has("task-3")).toBe(true);
  });

  it("returns empty set for empty snapshot", () => {
    const snapshot: WorkflowSnapshot = {
      workflowId: "wf-1",
      version: 1,
      name: "Empty",
      description: null,
      isNonTerminating: false,
      nodes: [],
      gates: [],
    };
    
    const taskIds = getSnapshotTaskIds(snapshot);
    
    expect(taskIds.size).toBe(0);
  });
});
