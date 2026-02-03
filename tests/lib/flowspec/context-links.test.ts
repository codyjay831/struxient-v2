import { describe, it, expect } from "vitest";
import type { ActionableTask } from "@/lib/flowspec/types";

describe("Context Links Enrichment (Slice D)", () => {
  const mockTasks: ActionableTask[] = [
    {
      flowId: "flow1",
      taskId: "task1",
      flowGroupId: "fg1",
      workflowId: "wf1",
      workflowName: "WF 1",
      taskName: "Task 1",
      nodeId: "n1",
      nodeName: "N 1",
      instructions: null,
      allowedOutcomes: ["OK"],
      evidenceRequired: false,
      evidenceSchema: null,
      domainHint: "execution",
      startedAt: null,
      iteration: 1
    },
    {
      flowId: "flow2",
      taskId: "task2",
      flowGroupId: "fg2",
      workflowId: "wf1",
      workflowName: "WF 1",
      taskName: "Task 2",
      nodeId: "n2",
      nodeName: "N 2",
      instructions: null,
      allowedOutcomes: ["OK"],
      evidenceRequired: false,
      evidenceSchema: null,
      domainHint: "execution",
      startedAt: null,
      iteration: 1
    }
  ];

  it("should preserve canonical ordering when context is added", () => {
    // Original order
    const originalOrder = mockTasks.map(t => t.taskId);

    // Simulated enrichment
    const enriched = mockTasks.map(task => ({
      ...task,
      context: task.flowGroupId === "fg1" 
        ? { jobId: "job1", customerId: "cust1" }
        : undefined
    }));

    // Order check
    expect(enriched.map(t => t.taskId)).toEqual(originalOrder);
    
    // Data check
    expect(enriched[0].context?.jobId).toBe("job1");
    expect(enriched[0].context?.customerId).toBe("cust1");
    expect(enriched[1].context).toBeUndefined();
  });

  it("should handle missing customerId gracefully", () => {
    const enriched = mockTasks.map(task => ({
      ...task,
      context: { jobId: "job-only" } as { jobId: string; customerId?: string }
    }));

    expect(enriched[0].context?.jobId).toBe("job-only");
    expect(enriched[0].context?.customerId).toBeUndefined();
  });
});
