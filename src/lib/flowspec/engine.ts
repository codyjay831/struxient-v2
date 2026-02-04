/**
 * FlowSpec Engine Core
 *
 * Canon Source: 10_flowspec_engine_contract.md
 * Epic: EPIC-01 FlowSpec Engine Core
 *
 * FlowSpec IS the execution engine. It defines AND executes workflows.
 * This is the primary interface for all FlowSpec operations.
 *
 * FOUNDATIONAL BOUNDARY (NON-NEGOTIABLE):
 * FlowSpec is the sole engine responsible for defining and executing workflows.
 * The Work Station does not execute workflows; it exists solely to perform
 * and submit human work (tasks) into FlowSpec.
 *
 * AUTHORIZATION BOUNDARY:
 * The FlowSpec Engine does NOT perform authorization checks. It trusts that
 * the API layer has verified tenant ownership (actor's companyId matches
 * Flow's companyId) before invoking any function.
 *
 * INVARIANTS ENFORCED:
 * - INV-001: No work outside Tasks
 * - INV-002: Explicit outcomes only
 * - INV-003: Gates route only
 * - INV-006: Determinism
 * - INV-007: Outcome immutability
 * - INV-009: FlowSpec owns Truth
 * - INV-010: Flow bound to version
 * - INV-012: Graph-first execution
 * - INV-013: No inferred Task state
 * - INV-019: FlowSpec evaluates Actionability
 * - INV-022: Actionability at start only
 * - INV-024: Gate key is Node-level
 */

import { prisma } from "@/lib/prisma";
import type { Flow, NodeActivation, TaskExecution, EvidenceAttachment, Prisma } from "@prisma/client";
import { FlowStatus, EvidenceType } from "@prisma/client";
import {
  FLOW_WITH_RELATIONS_INCLUDE,
  WorkflowSnapshot,
  SnapshotNode,
  ActionableTask,
  RecordTaskStartResult,
  RecordOutcomeResult,
  GateEvaluationResult,
  NodeActivationResult,
  EngineError,
  FlowWithRelations,
  ActionRefusal,
} from "./types";
import { isValidOutcome } from "./types";
import {
  recordNodeActivation,
  recordTaskStart as truthRecordTaskStart,
  recordOutcome as truthRecordOutcome,
  attachEvidence as truthAttachEvidence,
  getNodeActivations,
  getTaskExecutions,
  getTaskEvidence,
  getLatestNodeActivation,
  updateFlowStatus,
  getFlowGroupOutcomes,
} from "./truth";

/**
 * Records a ValidityEvent in Truth.
 */
export async function recordValidityEvent(
  taskExecutionId: string,
  state: "VALID" | "PROVISIONAL" | "INVALID",
  userId: string,
  reason?: string,
  tx?: Prisma.TransactionClient,
  now?: Date
) {
  const client = tx || prisma;
  return client.validityEvent.create({
    data: {
      taskExecutionId,
      state,
      reason,
      createdBy: userId,
      createdAt: now || new Date(),
    },
  });
}

// =============================================================================
// DETOUR OPERATIONS
// =============================================================================

/**
 * Opens a Detour on a Flow.
 * PHASE-3 LOCK: checkpointTaskExecutionId is required to anchor the validity overlay.
 */
export async function openDetour(
  flowId: string,
  checkpointNodeId: string,
  resumeTargetNodeId: string,
  userId: string,
  checkpointTaskExecutionId: string,
  type: "NON_BLOCKING" | "BLOCKING" = "NON_BLOCKING",
  category?: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Calculate repeatIndex
    const existingDetours = await tx.detourRecord.findMany({
      where: { flowId, status: "ACTIVE" },
    });

    // INV-036: No Nested Detours (v1)
    if (existingDetours.length > 0) {
      throw new Error(JSON.stringify({ 
        code: "NESTED_DETOUR_FORBIDDEN", 
        message: "A detour is already active for this flow. Nested detours are not supported in v1." 
      }));
    }

    const repeatIndex = await tx.detourRecord.count({
      where: { flowId, checkpointNodeId },
    });

    // 2. Create DetourRecord
    const detour = await tx.detourRecord.create({
      data: {
        flowId,
        checkpointNodeId,
        checkpointTaskExecutionId,
        resumeTargetNodeId,
        type,
        status: "ACTIVE",
        category,
        repeatIndex,
        openedBy: userId,
      },
    });

    // 3. Emit ValidityEvent(PROVISIONAL) if anchored
    if (checkpointTaskExecutionId) {
      await recordValidityEvent(
        checkpointTaskExecutionId,
        "PROVISIONAL",
        userId,
        `Detour opened: ${detour.id}`,
        tx
      );
    }

    return detour;
  });
}

/**
 * Escalates a Detour to BLOCKING.
 */
export async function escalateDetour(
  detourId: string,
  userId: string
) {
  return prisma.detourRecord.update({
    where: { id: detourId },
    data: {
      type: "BLOCKING",
      escalatedAt: new Date(),
      escalatedBy: userId,
    },
  });
}

/**
 * Triggers Remediation for a Detour (CONVERTED).
 */
export async function triggerRemediation(
  detourId: string,
  userId: string
) {
  return prisma.detourRecord.update({
    where: { id: detourId },
    data: {
      status: "CONVERTED",
      convertedAt: new Date(),
      convertedBy: userId,
    },
  });
}
import {
  computeActionableTasks,
  computeTaskActionable,
  computeNodeComplete,
  computeFlowComplete,
  evaluateGates,
  computeValidityMap,
} from "./derived";
import { checkEvidenceRequirements, validateEvidenceData, type EvidenceSchema } from "./evidence";
import { executeFanOut } from "./instantiation/fanout";
import { HookContext } from "./hooks";
import { MAX_NODE_ITERATIONS } from "./constants";

// =============================================================================
// FLOW OPERATIONS
// =============================================================================

/**
 * Gets a Flow with all related execution data.
 *
 * @param flowId - The Flow ID
 * @returns The Flow with relations or null
 */
export async function getFlow(flowId: string): Promise<FlowWithRelations | null> {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: FLOW_WITH_RELATIONS_INCLUDE,
  });
  return flow as FlowWithRelations | null;
}

/**
 * Gets the Workflow snapshot for a Flow.
 * The snapshot is the immutable workflow structure at the time of publishing.
 *
 * @param flow - The Flow with workflowVersion
 * @returns The WorkflowSnapshot
 */
export function getWorkflowSnapshot(flow: FlowWithRelations): WorkflowSnapshot {
  return flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
}

// =============================================================================
// TASK OPERATIONS
// Canon: 10_flowspec_engine_contract.md §5.1
// =============================================================================

/**
 * Starts a Task.
 * A Task can only be started if it is Actionable.
 *
 * INV-022: Actionability constraints evaluated at Task start only.
 * Once a Task is started, constraints are not re-checked to block Outcome recording.
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @param userId - The user starting the Task
 * @returns RecordTaskStartResult
 */
export async function startTask(
  flowId: string,
  taskId: string,
  userId: string
): Promise<RecordTaskStartResult> {
  // Get Flow with all execution data
  const flow = await getFlow(flowId);

  if (!flow) {
    return {
      success: false,
      error: {
        code: "FLOW_NOT_FOUND",
        message: `Flow ${flowId} not found`,
      },
    };
  }

  if (flow.status === FlowStatus.BLOCKED) {
    return {
      success: false,
      error: {
        code: "FLOW_BLOCKED",
        message: `Flow ${flowId} is BLOCKED and cannot start new tasks. Contact admin.`,
      },
    };
  }

  const snapshot = getWorkflowSnapshot(flow);

  // Find the Task in the snapshot
  const { node, task } = findTaskInSnapshot(snapshot, taskId);

  if (!task || !node) {
    return {
      success: false,
      error: {
        code: "TASK_NOT_FOUND",
        message: `Task ${taskId} not found in workflow`,
      },
    };
  }

  // Get Flow Group outcomes for Cross-Flow Dependencies
  const groupOutcomes = await getFlowGroupOutcomes(flow.flowGroupId);

  // Check if Task is Actionable
  const isActionable = computeTaskActionable(
    task,
    node,
    flow.nodeActivations,
    flow.taskExecutions,
    flow.detours,
    flow.taskExecutions.flatMap(te => (te as any).validityEvents || []),
    snapshot,
    groupOutcomes
  );

  if (!isActionable) {
    return {
      success: false,
      error: {
        code: "TASK_NOT_ACTIONABLE",
        message: `Task ${taskId} is not currently Actionable`,
        details: {
          taskId,
          nodeId: node.id,
          nodeName: node.name,
          taskName: task.name,
        },
      },
    };
  }

  // Get current iteration for the Node
  const latestActivation = await getLatestNodeActivation(flowId, node.id);
  const iteration = latestActivation?.iteration ?? 1;

  // LOCK: Check if there is already an active (uncompleted) execution for this iteration
  const activeExecution = flow.taskExecutions.find(
    (te) => te.taskId === taskId && te.iteration === iteration && te.outcome === null
  );

  if (activeExecution) {
    return {
      success: false,
      error: {
        code: "TASK_ALREADY_STARTED",
        message: `Task ${taskId} is already in progress for iteration ${iteration}`,
        details: {
          taskExecutionId: activeExecution.id,
          startedAt: activeExecution.startedAt,
          startedBy: activeExecution.startedBy,
        },
      },
    };
  }

  // Record Task start in Truth
  const hookCtx = new HookContext();
  const taskExecution = await truthRecordTaskStart(
    flowId,
    taskId,
    userId,
    latestActivation?.id,
    iteration
  );

  hookCtx.queue({ type: "TASK_STARTED", flowId, taskId, userId });
  await hookCtx.flush();

  return {
    success: true,
    taskExecutionId: taskExecution.id,
  };
}

/**
 * Records an Outcome on a Task.
 * INV-007: Outcomes are immutable once recorded.
 *
 * This function:
 * 1. Validates the Outcome is allowed
 * 2. Checks evidence requirements (if any)
 * 3. Records the Outcome in Truth (inside $transaction)
 * 4. Evaluates Gates and activates target Nodes (inside $transaction)
 * 5. Executes Fan-Out (outside $transaction)
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @param outcome - The outcome value
 * @param userId - The user recording the outcome
 * @param detourId - Optional Detour ID if this outcome resolves a detour
 * @returns RecordOutcomeResult
 */
export async function recordOutcome(
  flowId: string,
  taskId: string,
  outcome: string,
  userId: string,
  detourId?: string
): Promise<RecordOutcomeResult> {
  // 1. Pre-transaction validation
  const flow = await getFlow(flowId);
  if (!flow) {
    return {
      success: false,
      error: { code: "FLOW_NOT_FOUND", message: `Flow ${flowId} not found` },
    };
  }

  if (flow.status === FlowStatus.BLOCKED) {
    return {
      success: false,
      error: { code: "FLOW_BLOCKED", message: `Flow ${flowId} is BLOCKED. Contact admin.` },
    };
  }

  const snapshot = getWorkflowSnapshot(flow);
  const { node, task } = findTaskInSnapshot(snapshot, taskId);

  if (!task || !node) {
    return {
      success: false,
      error: { code: "TASK_NOT_FOUND", message: `Task ${taskId} not found in workflow` },
    };
  }

  // 2. Business logic validation
  const latestActivation = await getLatestNodeActivation(flowId, node.id);
  const iteration = latestActivation?.iteration ?? 1;
  
  // LOCK: Check for spoofing (recordOutcome without detourId when detour is active at checkpoint)
  const activeDetour = flow.detours.find(
    d => d.checkpointNodeId === node.id && d.status === "ACTIVE"
  );
  if (activeDetour && !detourId) {
    return {
      success: false,
      error: { code: "DETOUR_SPOOF", message: "An active detour exists for this checkpoint. You must resolve it via the resolution path (provide detourId)." },
    };
  }

  // LOCK: Find the latest TaskExecution for this iteration that hasn't been completed
  const taskExecutionsForIteration = flow.taskExecutions
    .filter((te) => te.taskId === taskId && te.iteration === iteration)
    .sort((a, b) => {
      const timeA = a.startedAt?.getTime() ?? 0;
      const timeB = b.startedAt?.getTime() ?? 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

  const taskExecution = taskExecutionsForIteration.find(te => te.outcome === null);

  if (!taskExecution) {
    // If we have executions for this iteration but none are open, it means it's already done.
    if (taskExecutionsForIteration.length > 0) {
      return {
        success: false,
        error: { code: "OUTCOME_ALREADY_RECORDED", message: `Task ${taskId} already has a recorded outcome for iteration ${iteration}.` },
      };
    }

    return {
      success: false,
      error: { code: "TASK_NOT_STARTED", message: `Task ${taskId} has no active (uncompleted) execution for iteration ${iteration}.` },
    };
  }

  const allowedOutcomes = task.outcomes.map((o) => o.name);
  if (!isValidOutcome(outcome, allowedOutcomes)) {
    return {
      success: false,
      error: { code: "INVALID_OUTCOME", message: `Outcome "${outcome}" is not valid` },
    };
  }

  if (task.evidenceRequired) {
    const evidence = await getTaskEvidence(flowId, taskId);
    const requirementResult = checkEvidenceRequirements(task, evidence);
    if (!requirementResult.satisfied) {
      return {
        success: false,
        error: { code: "EVIDENCE_REQUIRED", message: requirementResult.error || "Evidence required" },
      };
    }
  }

  // DETOUR RESOLUTION VALIDATION
  let resolutionDetour: any = null;
  if (detourId) {
    resolutionDetour = await prisma.detourRecord.findUnique({
      where: { id: detourId },
    });

    if (!resolutionDetour || resolutionDetour.status !== "ACTIVE") {
      return {
        success: false,
        error: { code: "INVALID_DETOUR", message: "Detour is not active or not found." },
      };
    }

    if (resolutionDetour.checkpointNodeId !== node.id) {
      return {
        success: false,
        error: { code: "DETOUR_HIJACK", message: "This task does not belong to the detour's checkpoint node." },
      };
    }

    if (resolutionDetour.checkpointTaskExecutionId && resolutionDetour.checkpointTaskExecutionId === taskExecution.id) {
       // Cannot resolve using the same task execution that opened the detour
       // (Unless we allow it, but lock said: "recordOutcome(detourId=...) resolution branch")
    }
  }

  // 3. Atomic Unit of Progress
  const now = new Date(); // Tighten-up C: Single timestamp for atomic unit
  const hookCtx = new HookContext();
  
  let resultRecord: TaskExecution | undefined;
  let gateResults: GateEvaluationResult[] = [];
  let fanOutIntent: {
    nodeId: string;
    outcome: string;
    scope: { type: string; id: string };
    companyId: string;
    flowGroupId: string;
  } | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // a. Record Outcome (Tighten-up B: propagate tx)
      // PHASE-3: Pass explicit ID to ensure we update the correct record in append-only world
      const outcomeResult = await truthRecordOutcome(flowId, taskId, outcome, userId, iteration, tx, now, taskExecution.id);
      if (outcomeResult.error) throw new Error(JSON.stringify(outcomeResult.error));
      resultRecord = outcomeResult.taskExecution;

      hookCtx.queue({ type: "TASK_DONE", flowId, taskId, outcome, userId });

      // PHASE-3 DETOUR RESOLUTION BRANCH
      if (detourId && resolutionDetour) {
        // a. Record resolution linkage
        await tx.taskExecution.update({
          where: { id: resultRecord!.id },
          data: { resolvedDetourId: detourId },
        });

        // b. Emit ValidityEvent(VALID)
        await tx.validityEvent.create({
          data: {
            taskExecutionId: resultRecord!.id,
            state: "VALID",
            createdBy: userId,
            createdAt: now,
          },
        });

        // c. Resolve DetourRecord
        await tx.detourRecord.update({
          where: { id: detourId },
          data: {
            status: "RESOLVED",
            resolvedAt: now,
            resolvedBy: userId,
          },
        });

        // d. Stable Resume: Explicitly activate resumeTargetNodeId
        const resumeResult = await activateNode(flowId, resolutionDetour.resumeTargetNodeId, undefined, tx, now, hookCtx);
        if (!resumeResult.success) throw new Error(JSON.stringify(resumeResult.error));

        // e. Skip gate routing (bypass processGateRouting)
        gateResults = [{
          gateId: "STABLE_RESUME",
          sourceNodeId: node.id,
          outcomeName: outcome,
          targetNodeId: resolutionDetour.resumeTargetNodeId,
          activated: true,
        }];
      } else {
        // b. Routing (Node Activations) - Only for standard progress
        gateResults = await processGateRouting(flow, snapshot, node, iteration, tx, now, hookCtx);
      }

      // c. Check if Node completed for Fan-Out intent
      const updatedExecutions = await getTaskExecutions(flowId, tx);
      const allValidityEvents = (await tx.validityEvent.findMany({
        where: { taskExecution: { flowId } }
      }));
      const validityMap = computeValidityMap(allValidityEvents);

      const nodeIsComplete = computeNodeComplete(node, updatedExecutions, validityMap, iteration);
      if (nodeIsComplete) {
        fanOutIntent = {
          nodeId: node.id,
          outcome,
          scope: { type: flow.flowGroup.scopeType, id: flow.flowGroup.scopeId },
          companyId: flow.workflow.companyId,
          flowGroupId: flow.flowGroupId
        };
      }

      // d. Flow Completion check
      const currentActivations = await tx.nodeActivation.findMany({ where: { flowId } });
      const currentDetours = await tx.detourRecord.findMany({ where: { flowId } });
      
      const isComplete = computeFlowComplete(snapshot, currentActivations, updatedExecutions, currentDetours, allValidityEvents);
      if (isComplete && flow.status !== FlowStatus.BLOCKED) {
        await updateFlowStatus(flowId, FlowStatus.COMPLETED, undefined, tx, now);
        hookCtx.queue({ type: "FLOW_COMPLETED", flowId });
      }
    });
  } catch (err) {
    // If it's one of our thrown errors, return it
    try {
      const parsed = JSON.parse((err as Error).message);
      if (parsed.code) return { success: false, error: parsed };
    } catch { /* ignore */ }
    throw err;
  }

  // Transaction succeeded, flush hooks
  await hookCtx.flush();

  // Guard: Max Iteration Limit Check (Guard A)
  // If any gate result failed due to iteration limit, mark flow as BLOCKED.
  // This happens outside the transaction to preserve the outcome truth.
  const limitExceeded = gateResults.some(r => r.error?.code === "ITERATION_LIMIT_EXCEEDED");
  if (limitExceeded) {
    console.warn(`[FlowSpec] Iteration limit exceeded for flow ${flowId}. Marking as BLOCKED.`);
    try {
      await updateFlowStatus(flowId, FlowStatus.BLOCKED);
    } catch (err) {
      console.error("[FlowSpec] Failed to mark flow as BLOCKED after iteration limit:", err);
    }
  }

  // 4. Side Effects (OUTSIDE_TX)
  // Tighten-up A: Fanout failure MUST NOT roll back core truth.
  const intent = fanOutIntent as {
    nodeId: string;
    outcome: string;
    scope: { type: string; id: string };
    companyId: string;
    flowGroupId: string;
  } | null;

  if (intent) {
    try {
      await executeFanOut(
        flowId,
        intent.nodeId,
        intent.outcome,
        intent.scope,
        intent.companyId,
        intent.flowGroupId
      );
    } catch (err) {
      console.error("[FlowSpec] Fan-out failure (non-blocking for core truth):", err);
      // Item 3: Explicitly persist FlowStatus.BLOCKED for the triggering flowId
      try {
        await updateFlowStatus(flowId, FlowStatus.BLOCKED);
      } catch (blockErr) {
        console.error("[FlowSpec] Failed to mark flow as BLOCKED after fan-out failure:", blockErr);
      }
    }
  }

  return {
    success: true,
    taskExecutionId: resultRecord!.id,
    gateResults,
  };
}

/**
 * Attaches Evidence to a Task.
 * INV-005: Evidence is always attached to exactly one Task.
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @param type - Evidence type
 * @param data - Evidence data
 * @param userId - The user attaching evidence
 * @param idempotencyKey - Optional idempotency key
 * @returns The EvidenceAttachment or error
 */
export async function attachEvidence(
  flowId: string,
  taskId: string,
  type: EvidenceType,
  data: unknown,
  userId: string,
  idempotencyKey?: string
): Promise<{ evidenceAttachment?: EvidenceAttachment; error?: EngineError }> {
  // Verify Flow exists
  const flow = await getFlow(flowId);

  if (!flow) {
    return {
      error: {
        code: "FLOW_NOT_FOUND",
        message: `Flow ${flowId} not found`,
      },
    };
  }

  const snapshot = getWorkflowSnapshot(flow);

  // Verify Task exists in workflow
  const { task } = findTaskInSnapshot(snapshot, taskId);

  if (!task) {
    return {
      error: {
        code: "TASK_NOT_FOUND",
        message: `Task ${taskId} not found in workflow`,
      },
    };
  }

  // Get current iteration for the Node
  const { node } = findTaskInSnapshot(snapshot, taskId);
  const latestActivation = node
    ? await getLatestNodeActivation(flowId, node.id)
    : null;
  const iteration = latestActivation?.iteration ?? 1;

  // Find the TaskExecution if it exists
  const taskExecution = flow.taskExecutions.find(
    (te) => te.taskId === taskId && te.iteration === iteration
  );

  // Validate against schema if exists
  if (task.evidenceSchema) {
    const validationResult = validateEvidenceData(
      type,
      data,
      task.evidenceSchema as unknown as EvidenceSchema
    );
    if (!validationResult.valid) {
      return {
        error: {
          code: "INVALID_EVIDENCE_FORMAT",
          message: validationResult.error || "Evidence does not match required schema",
          details: {
            taskId,
            evidenceSchema: task.evidenceSchema,
          },
        },
      };
    }
  }

  // INVARIANT: FILE evidence must contain pointer metadata only (no binary data)
  // Validate FILE pointer shape
  if (type === "FILE") {
    // Basic structural validation without importing storage client
    if (typeof data !== "object" || data === null) {
      return {
        error: {
          code: "INVALID_FILE_POINTER",
          message: "FILE evidence data must be an object",
        },
      };
    }

    const pointer = data as Record<string, unknown>;
    if (typeof pointer.storageKey !== "string" || !pointer.storageKey) {
      return {
        error: {
          code: "INVALID_FILE_POINTER",
          message: "storageKey is required and must be a non-empty string",
        },
      };
    }

    // Validate tenant isolation via key prefix
    // Format: {companyId}/evidence/...
    if (!pointer.storageKey.startsWith(`${flow.workflow.companyId}/`)) {
      return {
        error: {
          code: "STORAGE_KEY_TENANT_MISMATCH",
          message: "Storage key does not belong to this tenant",
        },
      };
    }
  }

  // Attach evidence in Truth
  return truthAttachEvidence(
    flowId,
    taskId,
    type,
    data,
    userId,
    taskExecution?.id,
    idempotencyKey
  );
}

// =============================================================================
// ACTIONABILITY QUERIES
// Canon: 10_flowspec_engine_contract.md §9.1
// =============================================================================

/**
 * Gets all Actionable Tasks for a Flow.
 * INV-019: FlowSpec evaluates all Actionability.
 *
 * @param flowId - The Flow ID
 * @returns Array of ActionableTask objects
 */
export async function getActionableTasks(flowId: string): Promise<ActionableTask[]> {
  const flow = await getFlow(flowId);

  if (!flow) {
    return [];
  }

  const snapshot = getWorkflowSnapshot(flow);

  // Fetch group outcomes for cross-flow dependency evaluation
  const groupOutcomes = await getFlowGroupOutcomes(flow.flowGroupId);

  return computeActionableTasks(
    snapshot,
    flow.nodeActivations,
    flow.taskExecutions,
    flow.detours,
    flow.taskExecutions.flatMap(te => (te as any).validityEvents || []),
    {
      flowId,
      flowGroupId: flow.flowGroupId,
      workflowId: flow.workflowId,
      workflowName: flow.workflow.name,
    },
    groupOutcomes
  );
}

/**
 * Checks if a specific Task is Actionable.
 *
 * @param flowId - The Flow ID
 * @param taskId - The Task ID
 * @returns True if the Task is Actionable
 */
export async function isTaskActionable(
  flowId: string,
  taskId: string
): Promise<boolean> {
  const flow = await getFlow(flowId);

  if (!flow) {
    return false;
  }

  const snapshot = getWorkflowSnapshot(flow);
  const { node, task } = findTaskInSnapshot(snapshot, taskId);

  if (!task || !node) {
    return false;
  }

  const groupOutcomes = await getFlowGroupOutcomes(flow.flowGroupId);

  return computeTaskActionable(
    task,
    node,
    flow.nodeActivations,
    flow.taskExecutions,
    flow.detours,
    flow.taskExecutions.flatMap(te => (te as any).validityEvents || []),
    snapshot,
    groupOutcomes
  );
}

// =============================================================================
// NODE OPERATIONS
// Canon: 10_flowspec_engine_contract.md §5.2
// =============================================================================

/**
 * Activates a Node (Entry Node or via Gate routing).
 * Creates a NodeActivation record in Truth.
 *
 * @param flowId - The Flow ID
 * @param nodeId - The Node ID
 * @param iteration - Optional iteration (for cycles, defaults to calculated)
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @param hookCtx - Optional HookContext to queue activation event
 * @returns NodeActivationResult
 */
export async function activateNode(
  flowId: string,
  nodeId: string,
  iteration?: number,
  tx?: Prisma.TransactionClient,
  now?: Date,
  hookCtx?: HookContext
): Promise<NodeActivationResult> {
  // Calculate iteration if not provided
  let activationIteration = iteration;
  if (activationIteration === undefined) {
    const latestActivation = await getLatestNodeActivation(flowId, nodeId, tx);
    activationIteration = latestActivation ? latestActivation.iteration + 1 : 1;
  }

  // Guard: Max Iteration Limit (Guard A)
  if (activationIteration > MAX_NODE_ITERATIONS) {
    return {
      success: false,
      error: {
        code: "ITERATION_LIMIT_EXCEEDED",
        message: `Node ${nodeId} has exceeded the maximum allowed iterations (${MAX_NODE_ITERATIONS}). Flow is BLOCKED to prevent infinite loop.`,
        details: { nodeId, iteration: activationIteration }
      }
    };
  }

  // Record NodeActivation in Truth
  const nodeActivation = await recordNodeActivation(
    flowId,
    nodeId,
    activationIteration,
    tx,
    now
  );

  if (hookCtx) {
    hookCtx.queue({
      type: "NODE_ACTIVATED",
      flowId,
      nodeId,
      iteration: nodeActivation.iteration,
    });
  }

  return {
    success: true,
    nodeActivationId: nodeActivation.id,
    iteration: nodeActivation.iteration,
  };
}

/**
 * Activates Entry Nodes for a newly created Flow.
 * Called when a Flow is instantiated.
 *
 * @param flowId - The Flow ID
 * @param snapshot - The Workflow snapshot
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @param hookCtx - Optional HookContext to queue activation events
 * @returns Array of NodeActivationResult
 */
export async function activateEntryNodes(
  flowId: string,
  snapshot: WorkflowSnapshot,
  tx?: Prisma.TransactionClient,
  now?: Date,
  hookCtx?: HookContext
): Promise<NodeActivationResult[]> {
  const entryNodes = snapshot.nodes.filter((n) => n.isEntry);
  const results: NodeActivationResult[] = [];

  for (const node of entryNodes) {
    const result = await activateNode(flowId, node.id, 1, tx, now, hookCtx);
    results.push(result);
  }

  return results;
}

// =============================================================================
// GATE ROUTING
// Canon: 10_flowspec_engine_contract.md §5.5
// =============================================================================

/**
 * Processes Gate routing after a Node is completed.
 * Evaluates Gates and activates target Nodes.
 *
 * @param flow - The Flow with execution data
 * @param snapshot - The Workflow snapshot
 * @param node - The completed Node
 * @param iteration - The current iteration
 * @param tx - Optional Prisma transaction client
 * @param now - Optional timestamp to use
 * @param hookCtx - Optional HookContext to queue activation events
 * @returns Array of GateEvaluationResult
 */
async function processGateRouting(
  flow: FlowWithRelations,
  snapshot: WorkflowSnapshot,
  node: SnapshotNode,
  iteration: number,
  tx?: Prisma.TransactionClient,
  now?: Date,
  hookCtx?: HookContext
): Promise<GateEvaluationResult[]> {
  const client = tx || prisma;
  // Re-fetch task executions to get latest state (Tighten-up B: use tx)
  const taskExecutions = await getTaskExecutions(flow.id, tx);
  const validityEvents = await client.validityEvent.findMany({
    where: { taskExecution: { flowId: flow.id } }
  });
  const validityMap = computeValidityMap(validityEvents);

  // Check if Node is complete (Validity Aware)
  const isComplete = computeNodeComplete(node, taskExecutions, validityMap, iteration);

  if (!isComplete) {
    // Node not complete yet, no gate routing
    return [];
  }

  // Evaluate Gates (Validity Aware)
  const routes = evaluateGates(node, taskExecutions, validityMap, snapshot.gates, iteration);
  const results: GateEvaluationResult[] = [];

  for (const route of routes) {
    if (route.targetNodeId === null) {
      // Terminal path - no activation needed
      results.push({
        gateId: route.gateId,
        sourceNodeId: route.sourceNodeId,
        outcomeName: route.outcomeName,
        targetNodeId: null,
        activated: false,
        isTerminal: true, // Marker for terminal paths
      } as any);
    } else {
      // Activate target Node (handles cycles automatically)
      const activationResult = await activateNode(flow.id, route.targetNodeId, undefined, tx, now, hookCtx);
      results.push({
        gateId: route.gateId,
        sourceNodeId: route.sourceNodeId,
        outcomeName: route.outcomeName,
        targetNodeId: route.targetNodeId,
        activated: activationResult.success,
        error: activationResult.error,
      });
    }
  }

  return results;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Finds a Task and its containing Node in the Workflow snapshot.
 *
 * @param snapshot - The Workflow snapshot
 * @param taskId - The Task ID
 * @returns Object containing the node and task, or undefined values
 */
function findTaskInSnapshot(
  snapshot: WorkflowSnapshot,
  taskId: string
): { node?: SnapshotNode; task?: SnapshotNode["tasks"][0] } {
  for (const node of snapshot.nodes) {
    const task = node.tasks.find((t) => t.id === taskId);
    if (task) {
      return { node, task };
    }
  }
  return {};
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  WorkflowSnapshot,
  ActionableTask,
  RecordTaskStartResult,
  RecordOutcomeResult,
  GateEvaluationResult,
  NodeActivationResult,
  EngineError,
};

export { FlowStatus, EvidenceType };
