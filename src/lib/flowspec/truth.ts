/**
 * FlowSpec Truth Persistence Layer
 *
 * Canon Source: 00_flowspec_glossary.md §3.1, 20_flowspec_invariants.md
 * Epic: EPIC-01 FlowSpec Engine Core
 *
 * Truth is the authoritative, persisted state of a Flow's execution.
 * Truth is append-only during execution (no retroactive edits).
 *
 * INVARIANTS ENFORCED:
 * - INV-007: Outcome Immutability - once recorded, cannot be changed
 * - INV-009: Only FlowSpec mutates execution Truth
 * - INV-005: No floating evidence - always attached to a Task
 *
 * AUTHORIZATION BOUNDARY:
 * These functions do NOT perform authorization checks. They trust that the
 * API layer has verified tenant ownership (actor's companyId matches Flow's
 * companyId) before invoking any Truth mutation.
 */

import { prisma } from "@/lib/prisma";
import type { NodeActivation, TaskExecution, EvidenceAttachment } from "@prisma/client";
import type {
  NodeActivationEvent,
  TaskStartEvent,
  OutcomeEvent,
  EvidenceEvent,
  EngineError,
} from "./types";
import { EvidenceType } from "./types";

// =============================================================================
// NODE ACTIVATION (TRUTH)
// Canon: 10_flowspec_engine_contract.md §5.2.1
// =============================================================================

/**
 * Records a NodeActivation event in Truth.
 * Called when a Node becomes active via Entry designation or Gate routing.
 *
 * @param flowId - The Flow instance ID
 * @param nodeId - The Node being activated
 * @param iteration - Iteration count for cycle tracking (default 1)
 * @returns The created NodeActivation record
 */
export async function recordNodeActivation(
  flowId: string,
  nodeId: string,
  iteration: number = 1
): Promise<NodeActivation> {
  const nodeActivation = await prisma.nodeActivation.create({
    data: {
      flowId,
      nodeId,
      iteration,
      activatedAt: new Date(),
    },
  });

  return nodeActivation;
}

/**
 * Gets all NodeActivation events for a Flow.
 *
 * @param flowId - The Flow instance ID
 * @returns Array of NodeActivation records
 */
export async function getNodeActivations(flowId: string): Promise<NodeActivation[]> {
  return prisma.nodeActivation.findMany({
    where: { flowId },
    orderBy: { activatedAt: "asc" },
  });
}

/**
 * Gets the latest NodeActivation for a specific Node in a Flow.
 * Used for determining current iteration in cycles.
 *
 * @param flowId - The Flow instance ID
 * @param nodeId - The Node ID
 * @returns The most recent NodeActivation or null
 */
export async function getLatestNodeActivation(
  flowId: string,
  nodeId: string
): Promise<NodeActivation | null> {
  return prisma.nodeActivation.findFirst({
    where: { flowId, nodeId },
    orderBy: { iteration: "desc" },
  });
}

// =============================================================================
// TASK EXECUTION (TRUTH)
// Canon: 10_flowspec_engine_contract.md §5.1
// =============================================================================

/**
 * Records a Task start event in Truth.
 * A Task can only be started if it is Actionable.
 *
 * @param flowId - The Flow instance ID
 * @param taskId - The Task being started
 * @param userId - The user starting the Task
 * @param nodeActivationId - Optional link to the NodeActivation that made this Task actionable
 * @param iteration - Iteration count for cycle tracking (default 1)
 * @returns The created/updated TaskExecution record
 */
export async function recordTaskStart(
  flowId: string,
  taskId: string,
  userId: string,
  nodeActivationId?: string,
  iteration: number = 1
): Promise<TaskExecution> {
  // Check if there's already a TaskExecution for this iteration
  const existing = await prisma.taskExecution.findFirst({
    where: {
      flowId,
      taskId,
      iteration,
    },
  });

  if (existing) {
    // If already started, this is an error condition (handled by caller)
    // Return the existing record for the caller to check
    return existing;
  }

  // Create new TaskExecution record
  const taskExecution = await prisma.taskExecution.create({
    data: {
      flowId,
      taskId,
      nodeActivationId,
      iteration,
      startedAt: new Date(),
      startedBy: userId,
    },
  });

  return taskExecution;
}

/**
 * Records an Outcome on a Task.
 * INV-007: Outcomes are immutable once recorded.
 *
 * @param flowId - The Flow instance ID
 * @param taskId - The Task ID
 * @param outcome - The outcome value (must be in Task's allowed outcomes)
 * @param userId - The user recording the outcome
 * @param iteration - Iteration count for cycle tracking (default 1)
 * @returns The updated TaskExecution record or error
 */
export async function recordOutcome(
  flowId: string,
  taskId: string,
  outcome: string,
  userId: string,
  iteration: number = 1
): Promise<{ taskExecution?: TaskExecution; error?: EngineError }> {
  // Find the TaskExecution for this iteration
  const taskExecution = await prisma.taskExecution.findFirst({
    where: {
      flowId,
      taskId,
      iteration,
    },
  });

  if (!taskExecution) {
    return {
      error: {
        code: "TASK_NOT_STARTED",
        message: `Task ${taskId} has not been started for iteration ${iteration}`,
      },
    };
  }

  // INV-007: Check if outcome already recorded (immutability)
  if (taskExecution.outcome !== null) {
    return {
      error: {
        code: "OUTCOME_ALREADY_RECORDED",
        message: `Outcome already recorded for Task ${taskId}. Outcomes are immutable (INV-007).`,
        details: {
          existingOutcome: taskExecution.outcome,
          attemptedOutcome: outcome,
        },
      },
    };
  }

  // Record the outcome
  // NOTE: We use a raw update here because TaskExecution has no @updatedAt
  // to maintain Truth immutability semantics
  const updated = await prisma.taskExecution.update({
    where: { id: taskExecution.id },
    data: {
      outcome,
      outcomeAt: new Date(),
      outcomeBy: userId,
    },
  });

  return { taskExecution: updated };
}

/**
 * Gets all TaskExecution records for a Flow.
 *
 * @param flowId - The Flow instance ID
 * @returns Array of TaskExecution records
 */
export async function getTaskExecutions(flowId: string): Promise<TaskExecution[]> {
  return prisma.taskExecution.findMany({
    where: { flowId },
    orderBy: [{ taskId: "asc" }, { iteration: "asc" }],
  });
}

/**
 * Gets the TaskExecution for a specific Task and iteration.
 *
 * @param flowId - The Flow instance ID
 * @param taskId - The Task ID
 * @param iteration - The iteration (default 1)
 * @returns The TaskExecution or null
 */
export async function getTaskExecution(
  flowId: string,
  taskId: string,
  iteration: number = 1
): Promise<TaskExecution | null> {
  return prisma.taskExecution.findFirst({
    where: {
      flowId,
      taskId,
      iteration,
    },
  });
}

/**
 * Gets all TaskExecutions for a specific Task across all iterations.
 * Used for audit trail in cycles.
 *
 * @param flowId - The Flow instance ID
 * @param taskId - The Task ID
 * @returns Array of TaskExecution records across all iterations
 */
export async function getTaskExecutionHistory(
  flowId: string,
  taskId: string
): Promise<TaskExecution[]> {
  return prisma.taskExecution.findMany({
    where: { flowId, taskId },
    orderBy: { iteration: "asc" },
  });
}

// =============================================================================
// EVIDENCE ATTACHMENT (TRUTH)
// Canon: 10_flowspec_engine_contract.md §5.3
// =============================================================================

/**
 * Attaches Evidence to a Task.
 * INV-005: Evidence is always attached to exactly one Task.
 *
 * @param flowId - The Flow instance ID
 * @param taskId - The Task ID
 * @param type - Evidence type (FILE, TEXT, STRUCTURED)
 * @param data - Evidence data (file reference or content)
 * @param userId - The user attaching the evidence
 * @param taskExecutionId - Optional link to specific TaskExecution
 * @param idempotencyKey - Optional key to prevent duplicate attachments
 * @returns The created EvidenceAttachment record or error
 */
export async function attachEvidence(
  flowId: string,
  taskId: string,
  type: EvidenceType,
  data: unknown,
  userId: string,
  taskExecutionId?: string,
  idempotencyKey?: string
): Promise<{ evidenceAttachment?: EvidenceAttachment; error?: EngineError }> {
  // Check for duplicate if idempotency key provided
  if (idempotencyKey) {
    const existing = await prisma.evidenceAttachment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      // Idempotent - return existing record
      return { evidenceAttachment: existing };
    }
  }

  try {
    const evidenceAttachment = await prisma.evidenceAttachment.create({
      data: {
        flowId,
        taskId,
        taskExecutionId,
        type,
        data: data as object,
        attachedBy: userId,
        idempotencyKey,
        attachedAt: new Date(),
      },
    });

    return { evidenceAttachment };
  } catch (error) {
    // Handle unique constraint violation on idempotency key (race condition)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      const existing = await prisma.evidenceAttachment.findUnique({
        where: { idempotencyKey: idempotencyKey! },
      });
      if (existing) {
        return { evidenceAttachment: existing };
      }
    }
    throw error;
  }
}

/**
 * Gets all EvidenceAttachments for a Task.
 *
 * @param flowId - The Flow instance ID
 * @param taskId - The Task ID
 * @returns Array of EvidenceAttachment records
 */
export async function getTaskEvidence(
  flowId: string,
  taskId: string
): Promise<EvidenceAttachment[]> {
  return prisma.evidenceAttachment.findMany({
    where: { flowId, taskId },
    orderBy: { attachedAt: "asc" },
  });
}

/**
 * Gets all EvidenceAttachments for a Flow.
 *
 * @param flowId - The Flow instance ID
 * @returns Array of EvidenceAttachment records
 */
export async function getFlowEvidence(flowId: string): Promise<EvidenceAttachment[]> {
  return prisma.evidenceAttachment.findMany({
    where: { flowId },
    orderBy: { attachedAt: "asc" },
  });
}

// =============================================================================
// FLOW STATE (TRUTH)
// =============================================================================

/**
 * Updates Flow status.
 * Used for marking Flow as COMPLETED, SUSPENDED, or BLOCKED.
 *
 * @param flowId - The Flow instance ID
 * @param status - The new FlowStatus
 * @param completedAt - Optional completion timestamp
 */
export async function updateFlowStatus(
  flowId: string,
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "BLOCKED",
  completedAt?: Date
): Promise<void> {
  return prisma.flow.update({
    where: { id: flowId },
    data: {
      status,
      completedAt: completedAt ?? (status === "COMPLETED" ? new Date() : undefined),
    },
  });
}

/**
 * Gets all recorded Outcomes for all Flows in a Flow Group.
 * Used for evaluating Cross-Flow Dependencies.
 *
 * Canon: 20_flowspec_invariants.md INV-021
 *
 * @param flowGroupId - The Flow Group ID
 * @returns Array of Outcome records with their Workflow ID
 */
export async function getFlowGroupOutcomes(
  flowGroupId: string
): Promise<{ workflowId: string; taskId: string; outcome: string }[]> {
  const executions = await prisma.taskExecution.findMany({
    where: {
      flow: {
        flowGroupId,
      },
      outcome: { not: null },
    },
    select: {
      taskId: true,
      outcome: true,
      flow: {
        select: {
          workflowId: true,
        },
      },
    },
  });

  return executions.map((ex) => ({
    workflowId: ex.flow.workflowId,
    taskId: ex.taskId,
    outcome: ex.outcome!,
  }));
}
