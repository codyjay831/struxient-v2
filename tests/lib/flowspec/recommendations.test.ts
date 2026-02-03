import { describe, it, expect } from "vitest";
import { buildRecommendations } from "@/lib/flowspec/recommendations";
import type { ActionableTask } from "@/lib/flowspec/types";

describe("Recommendation Engine (Slice E)", () => {
  const baseTask: ActionableTask = {
    flowId: "flow1",
    taskId: "task1",
    flowGroupId: "fg1",
    workflowId: "wf1",
    workflowName: "Work Flow",
    taskName: "Task 1",
    nodeId: "n1",
    nodeName: "Node 1",
    instructions: null,
    allowedOutcomes: ["DONE"],
    evidenceRequired: false,
    evidenceSchema: null,
    iteration: 1,
    domainHint: "execution",
    startedAt: null
  };

  it("should recommend 'open_task' when evidence is missing", () => {
    const task: ActionableTask = {
      ...baseTask,
      diagnostics: {
        evidence: {
          required: true,
          status: "missing",
          reason: "Schema mismatch"
        }
      }
    };

    const recs = buildRecommendations(task);
    expect(recs).toBeDefined();
    expect(recs![0].kind).toBe("open_task");
    expect(recs![0].severity).toBe("block");
    expect(recs![0].reason).toBe("Schema mismatch");
  });

  it("should recommend 'open_job' and 'open_customer' when context is present", () => {
    const task: ActionableTask = {
      ...baseTask,
      context: {
        jobId: "job123",
        customerId: "cust456"
      }
    };

    const recs = buildRecommendations(task);
    expect(recs).toHaveLength(2);
    expect(recs?.map(r => r.kind)).toContain("open_job");
    expect(recs?.map(r => r.kind)).toContain("open_customer");
    expect(recs?.find(r => r.kind === "open_job")?.href).toBe("/jobs/job123");
  });

  it("should recommend 'open_settings' when task is overdue", () => {
    const task: ActionableTask = {
      ...baseTask,
      _signals: {
        isOverdue: true,
        isDueSoon: false,
        jobPriority: "HIGH",
        effectiveSlaHours: 24,
        effectiveDueAt: new Date().toISOString()
      }
    };

    const recs = buildRecommendations(task);
    expect(recs?.map(r => r.kind)).toContain("open_settings");
    expect(recs?.find(r => r.kind === "open_settings")?.severity).toBe("warn");
  });

  it("should limit to max 4 recommendations and de-dupe", () => {
    // This task qualifies for all 4 rules
    const task: ActionableTask = {
      ...baseTask,
      diagnostics: { evidence: { required: true, status: "missing" } },
      context: { jobId: "j", customerId: "c" },
      _signals: { 
        isOverdue: true,
        isDueSoon: false,
        jobPriority: "HIGH",
        effectiveSlaHours: 1,
        effectiveDueAt: "..."
      }
    };

    const recs = buildRecommendations(task);
    expect(recs).toHaveLength(4);
    const kinds = recs?.map(r => r.kind);
    expect(new Set(kinds).size).toBe(kinds?.length);
  });

  it("should preserve canonical ordering (enrichment is non-destructive)", () => {
    const tasks: ActionableTask[] = [
      { ...baseTask, taskId: "A" },
      { ...baseTask, taskId: "B" }
    ];
    
    const enriched = tasks.map(t => ({
      ...t,
      recommendations: buildRecommendations(t)
    }));

    expect(enriched[0].taskId).toBe("A");
    expect(enriched[1].taskId).toBe("B");
  });
});
