/**
 * Work Station Filter Logic
 * 
 * Production logic for filtering actionable tasks.
 * Extracted for deterministic testing (WS-ED-01).
 *
 * INVARIANT: Filters NEVER change relative order.
 * Canonical ordering: flowId ASC → taskId ASC → iteration ASC
 */

import type { ActionableTask } from "../_components/task-feed";

/**
 * Filter tasks by "My Assignments" (Option A).
 * Relative order MUST be preserved.
 */
export function filterMyAssignments(
  tasks: ActionableTask[],
  assignmentFilter: boolean,
  currentMemberId: string | null
): ActionableTask[] {
  if (!assignmentFilter || !currentMemberId) return tasks;

  return tasks.filter(task => {
    const assignments = task._metadata?.assignments || [];
    return assignments.some(a => 
      a.assigneeType === 'PERSON' && 
      a.assignee.id === currentMemberId
    );
  });
}

/**
 * Filter configuration for signal-based filtering.
 * All filters are client-side only; canonical ordering unchanged.
 */
export interface SignalFilters {
  showOverdueOnly: boolean;
  showHighPriorityOnly: boolean;
}

/**
 * Apply signal-based filters to tasks.
 * Relative order MUST be preserved (no sorting).
 */
export function filterBySignals(
  tasks: ActionableTask[],
  filters: SignalFilters
): ActionableTask[] {
  let result = tasks;

  if (filters.showOverdueOnly) {
    result = result.filter(task => task._signals?.isOverdue === true);
  }

  if (filters.showHighPriorityOnly) {
    result = result.filter(task => 
      task._signals?.jobPriority === "HIGH" || 
      task._signals?.jobPriority === "URGENT"
    );
  }

  return result;
}

/**
 * Combined filter function applying all filters.
 * Order of filtering does not affect result (all are AND operations).
 */
export function applyAllFilters(
  tasks: ActionableTask[],
  assignmentFilter: boolean,
  currentMemberId: string | null,
  signalFilters: SignalFilters
): ActionableTask[] {
  let result = tasks;
  
  result = filterMyAssignments(result, assignmentFilter, currentMemberId);
  result = filterBySignals(result, signalFilters);
  
  return result;
}
