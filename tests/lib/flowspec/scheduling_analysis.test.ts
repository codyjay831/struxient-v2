import { describe, it, expect } from "vitest";
import { deriveSchedulingSignals } from "@/lib/flowspec/scheduling-analysis";
import type { ScheduleBlock, ScheduleChangeRequest, ScheduleTimeClass } from "@prisma/client";

describe("Scheduling Analysis (Phase F0)", () => {
  const now = new Date("2026-02-06T12:00:00Z");

  it("should detect resource overlaps", () => {
    const blocks: any[] = [
      {
        id: "b1",
        resourceId: "crew_1",
        timeClass: "COMMITTED" as ScheduleTimeClass,
        startAt: new Date("2026-02-06T13:00:00Z"),
        endAt: new Date("2026-02-06T15:00:00Z"),
        supersededAt: null,
      },
      {
        id: "b2",
        resourceId: "crew_1",
        timeClass: "PLANNED" as ScheduleTimeClass,
        startAt: new Date("2026-02-06T14:00:00Z"),
        endAt: new Date("2026-02-06T16:00:00Z"),
        supersededAt: null,
      }
    ];

    const signals = deriveSchedulingSignals(blocks, [], now);
    const overlap = signals.find(s => s.type === "CONFLICT" && s.what.includes("Resource overlap"));
    
    expect(overlap).toBeDefined();
    expect(overlap?.severity).toBe("CRITICAL");
    expect(overlap?.sourceIds).toContain("b1");
    expect(overlap?.sourceIds).toContain("b2");
  });

  it("should detect double-booked tasks", () => {
    const blocks: any[] = [
      {
        id: "b1",
        taskId: "task_123",
        timeClass: "COMMITTED" as ScheduleTimeClass,
        startAt: new Date("2026-02-06T13:00:00Z"),
        endAt: new Date("2026-02-06T15:00:00Z"),
        supersededAt: null,
      },
      {
        id: "b2",
        taskId: "task_123",
        timeClass: "COMMITTED" as ScheduleTimeClass,
        startAt: new Date("2026-02-07T13:00:00Z"),
        endAt: new Date("2026-02-07T15:00:00Z"),
        supersededAt: null,
      }
    ];

    const signals = deriveSchedulingSignals(blocks, [], now);
    const doubleBooked = signals.find(s => s.type === "CONFLICT" && s.what.includes("multiple commitments"));
    
    expect(doubleBooked).toBeDefined();
    expect(doubleBooked?.severity).toBe("CRITICAL");
    expect(doubleBooked?.sourceIds).toContain("b1");
    expect(doubleBooked?.sourceIds).toContain("b2");
  });

  it("should alert on approaching uncommitted work", () => {
    const blocks: any[] = [
      {
        id: "b1",
        timeClass: "PLANNED" as ScheduleTimeClass,
        startAt: new Date("2026-02-10T09:00:00Z"), // Within 7 days
        endAt: new Date("2026-02-10T11:00:00Z"),
        supersededAt: null,
      }
    ];

    const signals = deriveSchedulingSignals(blocks, [], now);
    const alert = signals.find(s => s.type === "ALERT" && s.what.includes("Uncommitted work"));
    
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("WARNING");
  });

  it("should alert on stale pending requests", () => {
    const requests: any[] = [
      {
        id: "r1",
        status: "PENDING",
        requestedAt: new Date("2026-02-01T12:00:00Z"), // 5 days ago
        taskId: "task_1",
      }
    ];

    const signals = deriveSchedulingSignals([], requests, now);
    const alert = signals.find(s => s.type === "ALERT" && s.what.includes("Stale change request"));
    
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("INFO");
  });
});
