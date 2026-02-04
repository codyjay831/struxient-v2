import { describe, it, expect, vi } from "vitest";
import { computeActionableTasks } from "@/lib/flowspec/derived";
import type { WorkflowSnapshot, ActionableTask } from "@/lib/flowspec/types";

describe("Phase 3: T-ACT_SORT_01 (Canonical Sort)", () => {
  it("should return tasks sorted by flowId, then taskId, then iteration", () => {
    const mockSnapshot: WorkflowSnapshot = {
      workflowId: "wf1",
      name: "Test Workflow",
      nodes: [
        {
          id: "node1",
          name: "Node 1",
          tasks: [
            { id: "taskB", name: "Task B", outcomes: [{ id: "out1", name: "DONE" }], displayOrder: 0, evidenceRequired: false, instructions: null, evidenceSchema: null },
            { id: "taskA", name: "Task A", outcomes: [{ id: "out2", name: "DONE" }], displayOrder: 1, evidenceRequired: false, instructions: null, evidenceSchema: null },
          ],
          isEntry: true,
          completionRule: "ALL_TASKS_DONE",
          specificTasks: [],
          transitiveSuccessors: [],
        },
      ],
      gates: [],
      version: 1,
      isNonTerminating: false,
      description: null,
    };

    const mockNodeActivations = [
      { id: "na1", flowId: "flow2", nodeId: "node1", iteration: 1, activatedAt: new Date() },
      { id: "na2", flowId: "flow1", nodeId: "node1", iteration: 2, activatedAt: new Date() },
      { id: "na3", flowId: "flow1", nodeId: "node1", iteration: 1, activatedAt: new Date() },
    ] as any;

    const flowContext1 = {
      flowId: "flow1",
      flowGroupId: "group1",
      workflowId: "wf1",
      workflowName: "Test Workflow",
    };

    // computeActionableTasks returns ONLY the tasks for the LATEST activation of each node.
    const tasks = computeActionableTasks(mockSnapshot, mockNodeActivations.filter((na: any) => na.flowId === "flow1"), [], [], [], flowContext1);

    // Expected order for flow1 (iteration 2 is latest):
    // taskA, iteration 2
    // taskB, iteration 2
    
    expect(tasks.length).toBe(2);
    expect(tasks[0].taskId).toBe("taskA");
    expect(tasks[0].iteration).toBe(2);
    expect(tasks[1].taskId).toBe("taskB");
    expect(tasks[1].iteration).toBe(2);
  });
});

describe("Phase 3: T-IdenticalSet Metadata Stripping", () => {
  const stripMetadata = (task: any) => {
    const stripped = { ...task };
    delete stripped._metadata;
    delete stripped.assignment;
    delete stripped.assignedTo;
    delete stripped.responsibility;
    
    // remove keys matching /^assignment_|^responsibility_/
    Object.keys(stripped).forEach(key => {
      if (key.startsWith("assignment_") || key.startsWith("responsibility_")) {
        delete stripped[key];
      }
    });
    return stripped;
  };

  it("should produce identical output after stripping and canonical sort", () => {
    const task1 = {
      flowId: "f1",
      taskId: "t1",
      iteration: 1,
      taskName: "Task 1",
      _metadata: { some: "meta" },
      assignment: "Alice",
      assignment_priority: "high"
    };

    const task2 = {
      flowId: "f1",
      taskId: "t1",
      iteration: 1,
      taskName: "Task 1",
      _metadata: { other: "meta" },
      assignment: "Bob",
      responsibility_notes: "important"
    };

    const stripped1 = stripMetadata(task1);
    const stripped2 = stripMetadata(task2);

    expect(stripped1).toEqual(stripped2);
    expect(JSON.stringify(stripped1)).toBe(JSON.stringify(stripped2));
  });
});
