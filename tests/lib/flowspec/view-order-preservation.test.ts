import { describe, it, expect } from "vitest";
import { filterBySignals, type SignalFilters } from "@/app/(app)/(fullbleed)/workstation/_lib/filter-logic";
import type { ActionableTask } from "@/app/(app)/(fullbleed)/workstation/_components/task-feed";

describe("View Order Preservation (Slice B)", () => {
  const mockTasks: ActionableTask[] = [
    {
      flowId: "flow1",
      taskId: "task1",
      flowGroupId: "fg1",
      workflowId: "wf1",
      workflowName: "WF 1",
      taskName: "Task 1 (Overdue)",
      nodeId: "n1",
      nodeName: "N 1",
      instructions: null,
      allowedOutcomes: ["OK"],
      evidenceRequired: false,
      evidenceSchema: null,
      domainHint: "execution",
      startedAt: null,
      _signals: {
        isOverdue: true,
        isDueSoon: false,
        jobPriority: "NORMAL",
        effectiveSlaHours: 24,
        effectiveDueAt: new Date().toISOString()
      }
    },
    {
      flowId: "flow1",
      taskId: "task2",
      flowGroupId: "fg1",
      workflowId: "wf1",
      workflowName: "WF 1",
      taskName: "Task 2 (Normal)",
      nodeId: "n2",
      nodeName: "N 2",
      instructions: null,
      allowedOutcomes: ["OK"],
      evidenceRequired: false,
      evidenceSchema: null,
      domainHint: "execution",
      startedAt: null,
      _signals: {
        isOverdue: false,
        isDueSoon: false,
        jobPriority: "NORMAL",
        effectiveSlaHours: 24,
        effectiveDueAt: new Date().toISOString()
      }
    },
    {
      flowId: "flow2",
      taskId: "task3",
      flowGroupId: "fg2",
      workflowId: "wf1",
      workflowName: "WF 1",
      taskName: "Task 3 (High Priority)",
      nodeId: "n3",
      nodeName: "N 3",
      instructions: null,
      allowedOutcomes: ["OK"],
      evidenceRequired: false,
      evidenceSchema: null,
      domainHint: "execution",
      startedAt: null,
      _signals: {
        isOverdue: false,
        isDueSoon: false,
        jobPriority: "HIGH",
        effectiveSlaHours: 24,
        effectiveDueAt: new Date().toISOString()
      }
    },
    {
      flowId: "flow2",
      taskId: "task4",
      flowGroupId: "fg2",
      workflowId: "wf1",
      workflowName: "WF 1",
      taskName: "Task 4 (Overdue & High)",
      nodeId: "n4",
      nodeName: "N 4",
      instructions: null,
      allowedOutcomes: ["OK"],
      evidenceRequired: false,
      evidenceSchema: null,
      domainHint: "execution",
      startedAt: null,
      _signals: {
        isOverdue: true,
        isDueSoon: false,
        jobPriority: "URGENT",
        effectiveSlaHours: 24,
        effectiveDueAt: new Date().toISOString()
      }
    }
  ];

  it("should preserve relative order in 'overdue' view", () => {
    const filters: SignalFilters = { view: "overdue", showOverdueOnly: false, showHighPriorityOnly: false };
    const filtered = filterBySignals(mockTasks, filters);
    
    // Expect Task 1 and Task 4 in that order
    expect(filtered).toHaveLength(2);
    expect(filtered[0].taskId).toBe("task1");
    expect(filtered[1].taskId).toBe("task4");
  });

  it("should preserve relative order in 'priority' view", () => {
    const filters: SignalFilters = { view: "priority", showOverdueOnly: false, showHighPriorityOnly: false };
    const filtered = filterBySignals(mockTasks, filters);
    
    // Expect Task 3 and Task 4 in that order
    expect(filtered).toHaveLength(2);
    expect(filtered[0].taskId).toBe("task3");
    expect(filtered[1].taskId).toBe("task4");
  });

  it("should preserve relative order when applying multiple filters", () => {
    const filters: SignalFilters = { view: "priority", showOverdueOnly: true, showHighPriorityOnly: false };
    const filtered = filterBySignals(mockTasks, filters);
    
    // Expect only Task 4 (both high priority and overdue)
    expect(filtered).toHaveLength(1);
    expect(filtered[0].taskId).toBe("task4");
  });
});
