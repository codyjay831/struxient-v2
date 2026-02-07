/**
 * Scheduling Analysis - Derived advisory conflicts and alerts
 * Canon: 01_scheduling_invariants_and_guards.canon.md
 * Phase F0: Minimal derived signals from ScheduleBlocks and Requests.
 */

import type { ScheduleBlock, ScheduleChangeRequest, ScheduleTimeClass } from "@prisma/client";
import { differenceInDays, isBefore, addDays } from "date-fns";

export interface SchedulingSignal {
  type: "CONFLICT" | "ALERT";
  severity: "CRITICAL" | "WARNING" | "INFO";
  what: string;
  why: string;
  resolution: string;
  risk: string;
  sourceIds: string[]; // IDs of blocks or requests involved
}

/**
 * Derives conflicts and alerts from current schedule state.
 * advisory-only, non-mutating.
 */
export function deriveSchedulingSignals(
  blocks: (ScheduleBlock & { timeClass: ScheduleTimeClass })[],
  requests: ScheduleChangeRequest[],
  now: Date = new Date()
): SchedulingSignal[] {
  const signals: SchedulingSignal[] = [];

  // --- CONFLICTS ---

  // 1. Resource Overlap (Same resourceId + overlapping windows)
  // Only consider non-superseded blocks (caller should provide active only)
  const activeBlocks = blocks.filter(b => !b.supersededAt);
  
  const resourceMap = new Map<string, typeof activeBlocks>();
  activeBlocks.forEach(b => {
    if (b.resourceId) {
      const list = resourceMap.get(b.resourceId) || [];
      list.push(b);
      resourceMap.set(b.resourceId, list);
    }
  });

  for (const [resourceId, resBlocks] of resourceMap.entries()) {
    for (let i = 0; i < resBlocks.length; i++) {
      for (let j = i + 1; j < resBlocks.length; j++) {
        const b1 = resBlocks[i];
        const b2 = resBlocks[j];

        // Check for overlap: (StartA < EndB) and (EndA > StartB)
        if (b1.startAt < b2.endAt && b1.endAt > b2.startAt) {
          signals.push({
            type: "CONFLICT",
            severity: "CRITICAL",
            what: `Resource overlap for ${b1.resourceType || 'Resource'} ${resourceId}`,
            why: `Two or more tasks are scheduled for the same resource at the same time.`,
            resolution: "Reschedule one of the tasks or assign a different resource via a Change Request.",
            risk: "Double-booking leads to inevitable delays and resource exhaustion.",
            sourceIds: [b1.id, b2.id],
          });
        }
      }
    }
  }

  // 2. Double-booked Task (Same taskId has 2+ active COMMITTED blocks)
  const taskMap = new Map<string, typeof activeBlocks>();
  activeBlocks.forEach(b => {
    if (b.taskId && b.timeClass === 'COMMITTED') {
      const list = taskMap.get(b.taskId) || [];
      list.push(b);
      taskMap.set(b.taskId, list);
    }
  });

  for (const [taskId, taskBlocks] of taskMap.entries()) {
    if (taskBlocks.length > 1) {
      signals.push({
        type: "CONFLICT",
        severity: "CRITICAL",
        what: `Task ${taskId} has multiple commitments`,
        why: `The same task has multiple active COMMITTED schedule blocks. This is an impossible state.`,
        resolution: "Manually supersede the incorrect block or contact system administrator.",
        risk: "Conflicting truth records cause ambiguity in execution and reporting.",
        sourceIds: taskBlocks.map(b => b.id),
      });
    }
  }

  // --- ALERTS ---

  // 3. Planned Approaching Threshold (PLANNED within 7 days but not committed)
  const threshold = addDays(now, 7);
  activeBlocks.forEach(b => {
    if (b.timeClass === 'PLANNED' && isBefore(b.startAt, threshold) && !isBefore(b.startAt, now)) {
      signals.push({
        type: "ALERT",
        severity: "WARNING",
        what: "Uncommitted work approaching",
        why: `Task ${b.taskId || b.id} is PLANNED within the next 7 days but has no COMMITTED window.`,
        resolution: "Review and commit the schedule via the confirmed outcome path.",
        risk: "Unconfirmed plans are likely to be missed or cause resource conflicts at the last minute.",
        sourceIds: [b.id],
      });
    }
  });

  // 4. Requested Unreviewed (PENDING requests older than 3 days)
  requests.forEach(r => {
    if (r.status === 'PENDING' && differenceInDays(now, r.requestedAt) >= 3) {
      signals.push({
        type: "ALERT",
        severity: "INFO",
        what: "Stale change request",
        why: `A schedule change request for task ${r.taskId || 'Unknown'} has been PENDING for ${differenceInDays(now, r.requestedAt)} days.`,
        resolution: "Review and Accept or Reject the request via the Workstation.",
        risk: "Delayed decisions on schedule changes increase uncertainty and planning overhead.",
        sourceIds: [r.id],
      });
    }
  });

  return signals;
}
