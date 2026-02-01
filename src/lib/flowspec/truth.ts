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
import type { NodeActivation, TaskExecution, EvidenceAttachment, Prisma } from "@prisma/client";
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
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use (for atomic units)
 * @returns The created NodeActivation record
 */
export async function recordNodeActivation(
  flowId: string,
  nodeId: string,
  iteration: number = 1,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<NodeActivation> {
  const client = tx || prisma;
  const nodeActivation = await client.nodeActivation.create({
    data: {
      flowId,
      nodeId,
      iteration,
      activatedAt: now || new Date(),
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
    orderBy: [{ activatedAt: "asc" }, { id: "asc" }],
  });
}

/**
 * Gets the latest NodeActivation for a specific Node in a Flow.
 * Used for determining current iteration in cycles.
 *
 * @param flowId - The Flow instance ID
 * @param nodeId - The Node ID
 * @param tx - Optional Prisma transaction client
 * @returns The most recent NodeActivation or null
 */
export async function getLatestNodeActivation(
  flowId: string,
  nodeId: string,
  tx?: Prisma.TransactionClient
): Promise<NodeActivation | null> {
  const client = tx || prisma;
  return client.nodeActivation.findFirst({
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
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @returns The created/updated TaskExecution record
 */
export async function recordTaskStart(
  flowId: string,
  taskId: string,
  userId: string,
  nodeActivationId?: string,
  iteration: number = 1,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<TaskExecution> {
  const client = tx || prisma;
  
  // Check if there's already a TaskExecution for this iteration
  const existing = await client.taskExecution.findFirst({
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
  const taskExecution = await client.taskExecution.create({
    data: {
      flowId,
      taskId,
      nodeActivationId,
      iteration,
      startedAt: now || new Date(),
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
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @returns The updated TaskExecution record or error
 */
export async function recordOutcome(
  flowId: string,
  taskId: string,
  outcome: string,
  userId: string,
  iteration: number = 1,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<{ taskExecution?: TaskExecution; error?: EngineError }> {
  const client = tx || prisma;

  // Find the TaskExecution for this iteration
  const taskExecution = await client.taskExecution.findFirst({
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
  const updated = await client.taskExecution.update({
    where: { id: taskExecution.id },
    data: {
      outcome,
      outcomeAt: now || new Date(),
      outcomeBy: userId,
    },
  });

  return { taskExecution: updated };
}

/**
 * Gets all TaskExecution records for a Flow.
 *
 * @param flowId - The Flow instance ID
 * @param tx - Optional Prisma transaction client
 * @returns Array of TaskExecution records
 */
export async function getTaskExecutions(
  flowId: string,
  tx?: Prisma.TransactionClient
): Promise<TaskExecution[]> {
  const client = tx || prisma;
  return client.taskExecution.findMany({
    where: { flowId },
    orderBy: [{ taskId: "asc" }, { iteration: "asc" }, { id: "asc" }],
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
    orderBy: [{ iteration: "asc" }, { id: "asc" }],
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
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @returns The created EvidenceAttachment record or error
 */
export async function attachEvidence(
  flowId: string,
  taskId: string,
  type: EvidenceType,
  data: unknown,
  userId: string,
  taskExecutionId?: string,
  idempotencyKey?: string,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<{ evidenceAttachment?: EvidenceAttachment; error?: EngineError }> {
  const client = tx || prisma;

  // Check for duplicate if idempotency key provided
  if (idempotencyKey) {
    const existing = await client.evidenceAttachment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      // Idempotent - return existing record
      return { evidenceAttachment: existing };
    }
  }

  try {
    const evidenceAttachment = await client.evidenceAttachment.create({
      data: {
        flowId,
        taskId,
        taskExecutionId,
        type,
        data: data as object,
        attachedBy: userId,
        idempotencyKey,
        attachedAt: now || new Date(),
      },
    });

    return { evidenceAttachment };
  } catch (error) {
    // Handle unique constraint violation on idempotency key (race condition)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      const existing = await client.evidenceAttachment.findUnique({
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
    orderBy: [{ attachedAt: "asc" }, { id: "asc" }],
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
    orderBy: [{ attachedAt: "asc" }, { id: "asc" }],
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
 * @param tx - Optional Prisma transaction client
 * @param now - Optional current timestamp
 */
export async function updateFlowStatus(
  flowId: string,
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "BLOCKED",
  completedAt?: Date,
  tx?: Prisma.TransactionClient,
  now?: Date
): Promise<void> {
  const client = tx || prisma;
  await client.flow.update({
    where: { id: flowId },
    data: {
      status,
      completedAt: completedAt ?? (status === "COMPLETED" ? (now || new Date()) : undefined),
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

/**
 * Gets the Anchor Identity evidence for a Flow Group.
 * B1: Stored on the Anchor Task of the Anchor Flow.
 */
export async function getAnchorIdentity(flowGroupId: string): Promise<{ customerId: string } | null> {
  const anchorFlow = await prisma.flow.findFirst({
    where: { flowGroupId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      workflowVersion: true,
    },
  });

  if (!anchorFlow) return null;

  // Anchor Task is deterministic: lowest displayOrder, then lexicographical ID in the entry node.
  const snapshot = anchorFlow.workflowVersion.snapshot as any;
  const entryNodes = snapshot.nodes.filter((n: any) => n.isEntry);
  const allEntryTasks = entryNodes.flatMap((n: any) => n.tasks);
  
  const anchorTask = [...allEntryTasks].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.id.localeCompare(b.id);
  })[0];

  if (!anchorTask) return null;

  const evidence = await prisma.evidenceAttachment.findFirst({
    where: {
      flowId: anchorFlow.id,
      taskId: anchorTask.id,
      type: "STRUCTURED",
    },
    orderBy: { attachedAt: "asc" },
  });

  if (!evidence || !evidence.data) return null;
  return (evidence.data as any).content || null;
}

/**
 * Gets the Sale Details evidence for a Task.
 */
export async function getSaleDetails(flowId: string, taskId: string): Promise<{ customerId: string; serviceAddress: string; packageId?: string; contractValue?: number } | null> {
  const evidence = await prisma.evidenceAttachment.findFirst({
    where: {
      flowId,
      taskId,
      type: "STRUCTURED",
    },
    orderBy: [{ attachedAt: "desc" }, { id: "desc" }],
  });

  if (!evidence || !evidence.data) return null;
  return (evidence.data as any).content || null;
}
