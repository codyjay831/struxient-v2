/**
 * FlowSpec Recommendation Engine (Projection Enrichment)
 * 
 * Computes deterministic next actions for actionable tasks.
 * Canon: 30_workstation_ui_api_map.md §5
 * 
 * INVARIANT: Recommendations are read-only navigation hints.
 * NO mutation state should be inferred.
 */

import type { ActionableTask } from "./types";

/**
 * Builds a list of recommended next actions for an actionable task.
 * Rules are prioritized and capped at 4 items.
 */
export function buildRecommendations(task: ActionableTask): ActionableTask["recommendations"] {
  const recs: NonNullable<ActionableTask["recommendations"]> = [];

  // R1: Missing Evidence (BLOCKER)
  if (task.diagnostics?.evidence?.required && task.diagnostics.evidence.status === "missing") {
    recs.push({
      kind: "open_task",
      label: "Open Task Execution",
      // Note: href is handled by the UI based on internal selection state in Work Station, 
      // but we provide a hint if needed.
      reason: task.diagnostics.evidence.reason || "Evidence is required before an outcome can be recorded.",
      severity: "block",
    });
  }

  // R2: Open Job Profile
  if (task.context?.jobId) {
    recs.push({
      kind: "open_job",
      label: "Open Job Profile",
      href: `/jobs/${task.context.jobId}`,
      reason: "Review job context and required metadata.",
      severity: "info",
    });
  }

  // R3: Open Customer
  if (task.context?.customerId) {
    recs.push({
      kind: "open_customer",
      label: "Open Customer",
      href: `/customers/${task.context.customerId}`,
      reason: "Review customer notes and history.",
      severity: "info",
    });
  }

  // R4: Overdue -> SLA / Policy Review
  if (task._signals?.isOverdue) {
    recs.push({
      kind: "open_settings",
      label: "Review SLA / Policy",
      href: "/settings", // Mapping to general settings as specific policy UI is internal to FG
      reason: "Task is overdue; review policy or SLA expectations.",
      severity: "warn",
    });
  }

  // De-dupe by kind and limit to max 4
  const seen = new Set<string>();
  return recs
    .filter(r => {
      if (seen.has(r.kind)) return false;
      seen.add(r.kind);
      return true;
    })
    .slice(0, 4);
}
