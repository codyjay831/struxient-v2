/**
 * Work Station Filter Logic
 * 
 * Production logic for filtering actionable tasks.
 * Extracted for deterministic testing (WS-ED-01).
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
