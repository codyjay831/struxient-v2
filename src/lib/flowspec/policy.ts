/**
 * FlowGroup Policy Projection
 *
 * Policy affects timing/signals ONLY, never workflow structure.
 * Merge semantics: Override (B) > Default (A) > null
 *
 * Canon Source: Policy Contract v1.0
 */

import { prisma } from "@/lib/prisma";
import type { FlowGroupPolicy, TaskPolicyOverride, JobPriority } from "@prisma/client";
import type { WorkflowSnapshot, SnapshotTask } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface EffectiveTaskPolicy {
  taskId: string;
  effectiveSlaHours: number | null; // B > A > null
  defaultSlaHours: number | null;   // A (from snapshot)
  overrideSlaHours: number | null;  // B (from policy)
}

export interface EffectivePolicy {
  flowGroupId: string;
  jobPriority: JobPriority;
  groupDueAt: Date | null;
  taskPolicies: Map<string, EffectiveTaskPolicy>;
}

export interface TaskSignals {
  jobPriority: JobPriority;
  effectiveSlaHours: number | null;
  effectiveDueAt: Date | null;
  isOverdue: boolean;
  isDueSoon: boolean; // Within 24 hours
}

// =============================================================================
// POLICY FETCHING
// =============================================================================

/**
 * Get FlowGroupPolicy with task overrides for a FlowGroup.
 */
export async function getFlowGroupPolicy(flowGroupId: string): Promise<FlowGroupPolicy & { taskOverrides: TaskPolicyOverride[] } | null> {
  return prisma.flowGroupPolicy.findUnique({
    where: { flowGroupId },
    include: { taskOverrides: true },
  });
}

/**
 * Get all task IDs from a workflow snapshot.
 * Used for validating task overrides against bound version.
 */
export function getSnapshotTaskIds(snapshot: WorkflowSnapshot): Set<string> {
  const taskIds = new Set<string>();
  for (const node of snapshot.nodes) {
    for (const task of node.tasks) {
      taskIds.add(task.id);
    }
  }
  return taskIds;
}

/**
 * Find a task in a snapshot by ID.
 */
export function findTaskInSnapshotById(snapshot: WorkflowSnapshot, taskId: string): SnapshotTask | null {
  for (const node of snapshot.nodes) {
    for (const task of node.tasks) {
      if (task.id === taskId) {
        return task;
      }
    }
  }
  return null;
}

// =============================================================================
// POLICY MERGE LOGIC
// =============================================================================

/**
 * Compute effective SLA using merge semantics: B > A > null
 * @param overrideSlaHours - B: Runtime override from TaskPolicyOverride
 * @param defaultSlaHours - A: Template default from Task/Snapshot
 */
export function mergeSlaPrecedence(
  overrideSlaHours: number | null | undefined,
  defaultSlaHours: number | null | undefined
): number | null {
  // B > A > null
  if (overrideSlaHours !== null && overrideSlaHours !== undefined) {
    return overrideSlaHours;
  }
  if (defaultSlaHours !== null && defaultSlaHours !== undefined) {
    return defaultSlaHours;
  }
  return null;
}

/**
 * Compute effective policy for a FlowGroup.
 * Merges snapshot defaults (A) with runtime overrides (B).
 */
export async function computeEffectivePolicy(
  flowGroupId: string,
  snapshot: WorkflowSnapshot
): Promise<EffectivePolicy> {
  const policy = await getFlowGroupPolicy(flowGroupId);

  const taskPolicies = new Map<string, EffectiveTaskPolicy>();

  // Build task policies from snapshot (A) merged with overrides (B)
  for (const node of snapshot.nodes) {
    for (const task of node.tasks) {
      const override = policy?.taskOverrides.find((o) => o.taskId === task.id);
      const overrideSlaHours = override?.slaHours ?? null;
      const defaultSlaHours = task.defaultSlaHours ?? null;

      taskPolicies.set(task.id, {
        taskId: task.id,
        effectiveSlaHours: mergeSlaPrecedence(overrideSlaHours, defaultSlaHours),
        defaultSlaHours,
        overrideSlaHours,
      });
    }
  }

  return {
    flowGroupId,
    jobPriority: policy?.jobPriority ?? "NORMAL",
    groupDueAt: policy?.groupDueAt ?? null,
    taskPolicies,
  };
}

// =============================================================================
// SIGNAL COMPUTATION
// =============================================================================

/**
 * Compute task signals based on effective policy and activation time.
 * DueAt is deterministic: activatedAt + effectiveSlaHours
 *
 * @param effectivePolicy - The computed effective policy
 * @param taskId - The task to compute signals for
 * @param activatedAt - When the node was activated (from NodeActivation.activatedAt)
 * @param asOf - Reference time for overdue computation (defaults to now)
 */
export function computeTaskSignals(
  effectivePolicy: EffectivePolicy,
  taskId: string,
  activatedAt: Date | null,
  asOf: Date = new Date()
): TaskSignals {
  const taskPolicy = effectivePolicy.taskPolicies.get(taskId);
  const effectiveSlaHours = taskPolicy?.effectiveSlaHours ?? null;

  // Compute effectiveDueAt deterministically
  let effectiveDueAt: Date | null = null;
  if (activatedAt && effectiveSlaHours !== null) {
    effectiveDueAt = new Date(activatedAt.getTime() + effectiveSlaHours * 60 * 60 * 1000);
  }

  // Compute overdue/due-soon flags
  const isOverdue = effectiveDueAt !== null && effectiveDueAt < asOf;
  const isDueSoon = effectiveDueAt !== null && !isOverdue && 
    (effectiveDueAt.getTime() - asOf.getTime()) < 24 * 60 * 60 * 1000;

  return {
    jobPriority: effectivePolicy.jobPriority,
    effectiveSlaHours,
    effectiveDueAt,
    isOverdue,
    isDueSoon,
  };
}

// =============================================================================
// POLICY VALIDATION
// =============================================================================

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate task overrides against the bound workflow version snapshot.
 * taskIds in overrides MUST exist in the snapshot.
 */
export function validateTaskOverrides(
  taskOverrides: { taskId: string; slaHours?: number | null }[],
  snapshot: WorkflowSnapshot
): PolicyValidationResult {
  const validTaskIds = getSnapshotTaskIds(snapshot);
  const errors: string[] = [];

  for (const override of taskOverrides) {
    if (!validTaskIds.has(override.taskId)) {
      errors.push(`Task ID "${override.taskId}" does not exist in the bound workflow version`);
    }
    if (override.slaHours !== null && override.slaHours !== undefined && override.slaHours < 0) {
      errors.push(`SLA hours for task "${override.taskId}" cannot be negative`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate job priority is a valid enum value.
 */
export function validateJobPriority(priority: string): priority is JobPriority {
  return ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority);
}
