/**
 * Signal Filters Tests
 *
 * Tests for workstation signal-based filtering.
 * INVARIANT: Filters must preserve canonical ordering.
 */

import { describe, it, expect } from "vitest";
import { filterBySignals, applyAllFilters, type SignalFilters } from "@/app/(app)/(fullbleed)/workstation/_lib/filter-logic";
import type { ActionableTask } from "@/app/(app)/(fullbleed)/workstation/_components/task-feed";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createTask = (
  id: string,
  signals?: {
    jobPriority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    isOverdue?: boolean;
    isDueSoon?: boolean;
  }
): ActionableTask => ({
  flowId: `flow-${id}`,
  flowGroupId: `fg-${id}`,
  workflowId: "wf-1",
  workflowName: "Test Workflow",
  taskId: `task-${id}`,
  taskName: `Task ${id}`,
  nodeId: "node-1",
  nodeName: "Node 1",
  instructions: null,
  allowedOutcomes: ["DONE"],
  evidenceRequired: false,
  evidenceSchema: null,
  domainHint: "execution",
  startedAt: null,
  _signals: {
    jobPriority: signals?.jobPriority ?? "NORMAL",
    effectiveSlaHours: null,
    effectiveDueAt: null,
    isOverdue: signals?.isOverdue ?? false,
    isDueSoon: signals?.isDueSoon ?? false,
  },
});

// =============================================================================
// CANONICAL ORDER PRESERVATION TESTS
// =============================================================================

describe("filterBySignals - ordering invariant", () => {
  const tasks: ActionableTask[] = [
    createTask("a", { isOverdue: true }),
    createTask("b", { jobPriority: "HIGH" }),
    createTask("c", { isOverdue: true, jobPriority: "HIGH" }),
    createTask("d", {}),
    createTask("e", { isOverdue: true }),
  ];

  it("preserves relative order when filtering by overdue", () => {
    const result = filterBySignals(tasks, { showOverdueOnly: true, showHighPriorityOnly: false });
    
    // Should contain only overdue tasks in original order
    expect(result.map(t => t.taskId)).toEqual(["task-a", "task-c", "task-e"]);
  });

  it("preserves relative order when filtering by priority", () => {
    const result = filterBySignals(tasks, { showOverdueOnly: false, showHighPriorityOnly: true });
    
    // Should contain only high priority tasks in original order
    expect(result.map(t => t.taskId)).toEqual(["task-b", "task-c"]);
  });

  it("preserves relative order with combined filters", () => {
    const result = filterBySignals(tasks, { showOverdueOnly: true, showHighPriorityOnly: true });
    
    // Should contain only tasks matching both filters in original order
    expect(result.map(t => t.taskId)).toEqual(["task-c"]);
  });

  it("returns all tasks when no filters active", () => {
    const result = filterBySignals(tasks, { showOverdueOnly: false, showHighPriorityOnly: false });
    
    expect(result.length).toBe(5);
    expect(result.map(t => t.taskId)).toEqual(tasks.map(t => t.taskId));
  });
});

describe("filterBySignals - urgency levels", () => {
  it("includes URGENT in high priority filter", () => {
    const tasks = [
      createTask("a", { jobPriority: "LOW" }),
      createTask("b", { jobPriority: "NORMAL" }),
      createTask("c", { jobPriority: "HIGH" }),
      createTask("d", { jobPriority: "URGENT" }),
    ];

    const result = filterBySignals(tasks, { showOverdueOnly: false, showHighPriorityOnly: true });
    
    expect(result.map(t => t.taskId)).toEqual(["task-c", "task-d"]);
  });
});

describe("applyAllFilters - combined filtering", () => {
  it("applies both assignment and signal filters", () => {
    const tasks: ActionableTask[] = [
      {
        ...createTask("a", { isOverdue: true }),
        _metadata: {
          assignments: [{ slotKey: "PM", assigneeType: "PERSON", assignee: { id: "member-1" } }]
        }
      },
      {
        ...createTask("b", { isOverdue: true }),
        _metadata: {
          assignments: [{ slotKey: "PM", assigneeType: "PERSON", assignee: { id: "member-2" } }]
        }
      },
      {
        ...createTask("c", { isOverdue: false }),
        _metadata: {
          assignments: [{ slotKey: "PM", assigneeType: "PERSON", assignee: { id: "member-1" } }]
        }
      },
    ];

    const result = applyAllFilters(
      tasks,
      true, // assignment filter enabled
      "member-1", // current member
      { showOverdueOnly: true, showHighPriorityOnly: false }
    );

    // Only task-a matches: assigned to member-1 AND overdue
    expect(result.map(t => t.taskId)).toEqual(["task-a"]);
  });
});
