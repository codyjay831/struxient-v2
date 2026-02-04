import { describe, it, expect } from "vitest";
import { createWorkflowSnapshot } from "@/lib/flowspec/lifecycle/versioning";
import { CompletionRule } from "@prisma/client";
import type { WorkflowWithRelations } from "@/lib/flowspec/types";

describe("WorkflowSnapshot: transitiveSuccessors", () => {
  it("should compute transitiveSuccessors for a linear graph", () => {
    const workflow: any = {
      id: "w1",
      name: "Linear",
      version: 1,
      isNonTerminating: false,
      nodes: [
        { id: "n1", name: "Node 1", isEntry: true, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n2", name: "Node 2", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n3", name: "Node 3", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
      ],
      gates: [
        { id: "g1", sourceNodeId: "n1", outcomeName: "DONE", targetNodeId: "n2" },
        { id: "g2", sourceNodeId: "n2", outcomeName: "DONE", targetNodeId: "n3" },
        { id: "g3", sourceNodeId: "n3", outcomeName: "DONE", targetNodeId: null },
      ],
    };

    const snapshot = createWorkflowSnapshot(workflow as WorkflowWithRelations);

    const n1 = snapshot.nodes.find(n => n.id === "n1");
    const n2 = snapshot.nodes.find(n => n.id === "n2");
    const n3 = snapshot.nodes.find(n => n.id === "n3");

    expect(n1?.transitiveSuccessors).toEqual(["n2", "n3"]);
    expect(n2?.transitiveSuccessors).toEqual(["n3"]);
    expect(n3?.transitiveSuccessors).toEqual([]);
  });

  it("should compute transitiveSuccessors for a fan-out graph", () => {
    const workflow: any = {
      id: "w2",
      name: "Fan-out",
      version: 1,
      isNonTerminating: false,
      nodes: [
        { id: "n1", name: "Node 1", isEntry: true, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n2", name: "Node 2", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n3", name: "Node 3", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n4", name: "Node 4", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
      ],
      gates: [
        { id: "g1", sourceNodeId: "n1", outcomeName: "A", targetNodeId: "n2" },
        { id: "g2", sourceNodeId: "n1", outcomeName: "B", targetNodeId: "n3" },
        { id: "g3", sourceNodeId: "n2", outcomeName: "DONE", targetNodeId: "n4" },
        { id: "g4", sourceNodeId: "n3", outcomeName: "DONE", targetNodeId: "n4" },
      ],
    };

    const snapshot = createWorkflowSnapshot(workflow as WorkflowWithRelations);

    const n1 = snapshot.nodes.find(n => n.id === "n1");
    const n2 = snapshot.nodes.find(n => n.id === "n2");
    const n3 = snapshot.nodes.find(n => n.id === "n3");
    const n4 = snapshot.nodes.find(n => n.id === "n4");

    expect(n1?.transitiveSuccessors.sort()).toEqual(["n2", "n3", "n4"].sort());
    expect(n2?.transitiveSuccessors).toEqual(["n4"]);
    expect(n3?.transitiveSuccessors).toEqual(["n4"]);
    expect(n4?.transitiveSuccessors).toEqual([]);
  });

  it("should handle cycles in transitiveSuccessors", () => {
    const workflow: any = {
      id: "w3",
      name: "Cycle",
      version: 1,
      isNonTerminating: false,
      nodes: [
        { id: "n1", name: "Node 1", isEntry: true, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n2", name: "Node 2", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
        { id: "n3", name: "Node 3", isEntry: false, completionRule: CompletionRule.ALL_TASKS_DONE, specificTasks: [], tasks: [] },
      ],
      gates: [
        { id: "g1", sourceNodeId: "n1", outcomeName: "NEXT", targetNodeId: "n2" },
        { id: "g2", sourceNodeId: "n2", outcomeName: "RETRY", targetNodeId: "n1" }, // Cycle back to n1
        { id: "g3", sourceNodeId: "n2", outcomeName: "NEXT", targetNodeId: "n3" },
      ],
    };

    const snapshot = createWorkflowSnapshot(workflow as WorkflowWithRelations);

    const n1 = snapshot.nodes.find(n => n.id === "n1");
    const n2 = snapshot.nodes.find(n => n.id === "n2");
    const n3 = snapshot.nodes.find(n => n.id === "n3");

    // n1 -> n2 -> n1, n1 -> n2 -> n3
    // From n1, successors are n2 and n3.
    expect(n1?.transitiveSuccessors.sort()).toEqual(["n2", "n3"].sort());
    // From n2, successors are n1 and n3.
    expect(n2?.transitiveSuccessors.sort()).toEqual(["n1", "n3"].sort());
    expect(n3?.transitiveSuccessors).toEqual([]);
  });
});
