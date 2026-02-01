import { describe, it, expect } from "vitest";
import { filterMyAssignments } from "@/app/(app)/workstation/_lib/filter-logic";
import type { ActionableTask } from "@/app/(app)/workstation/_components/task-feed";

/**
 * Work Station Determinism Proof (WS-ED-01)
 * 
 * This test uses an adversarial fixture with non-sequential IDs and
 * iteration spreads to prove that the production filter logic
 * preserves the canonical relative order from the API.
 */
describe("Work Station Determinism (WS-ED-01)", () => {
  const sentinelId = "current-mem-123";

  // ADVERSARIAL FIXTURE: Non-sequential IDs + Tempting reorder keys
  const apiTasks: ActionableTask[] = [
    { 
      flowId: "FLOW-Z", taskId: "TASK-99", iteration: 9, 
      taskName: "Adversarial 1", sentinel: "POS-1",
      _metadata: { assignments: [{ assigneeType: 'PERSON', assignee: { id: sentinelId }, slotKey: 'PM' }] }
    } as any,
    { 
      flowId: "FLOW-A", taskId: "TASK-01", iteration: 1, 
      taskName: "Adversarial 2", sentinel: "POS-2",
      _metadata: { assignments: [{ assigneeType: 'PERSON', assignee: { id: 'other' }, slotKey: 'PM' }] }
    } as any,
    { 
      flowId: "FLOW-M", taskId: "TASK-50", iteration: 5, 
      taskName: "Adversarial 3", sentinel: "POS-3",
      _metadata: { assignments: [{ assigneeType: 'PERSON', assignee: { id: sentinelId }, slotKey: 'PM' }] }
    } as any,
  ];

  it("T-Order-Identity: Unfiltered list preserves API order exactly", () => {
    // Production logic call
    const result = filterMyAssignments(apiTasks, false, sentinelId);
    
    // Assert exactly same sequence of sentinels
    expect(result.map(t => (t as any).sentinel)).toEqual(["POS-1", "POS-2", "POS-3"]);
  });

  it("T-Relative-Order: Filtered list preserves relative API order", () => {
    // Production logic call (Option A Filter ON)
    const result = filterMyAssignments(apiTasks, true, sentinelId);
    
    // POS-2 is removed because it's assigned to 'other'
    // Relative order of POS-1 and POS-3 must remain identical to input
    expect(result.map(t => (t as any).sentinel)).toEqual(["POS-1", "POS-3"]);
  });

  it("T-No-Implicit-Sort: Ensure no sorting by common keys (ID or Iteration)", () => {
    const result = filterMyAssignments(apiTasks, false, sentinelId);
    
    // If logic sorted by taskId (alpha) -> POS-2 would be first.
    // If logic sorted by iteration (numeric) -> POS-2 would be first.
    // If logic sorted by flowId (alpha) -> POS-2 would be first.
    expect(result[0].taskName).toBe("Adversarial 1"); // POS-1 remains first
  });
});
