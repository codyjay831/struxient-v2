/**
 * FlowSpec Workflow Lifecycle Transitions
 *
 * Canon Source: 10_flowspec_engine_contract.md §7
 */

import { prisma } from "../../prisma";
import { WorkflowStatus } from "@prisma/client";
import { validateWorkflow } from "../validation";
import type { WorkflowWithRelations } from "../types";
import type { LifecycleTransitionResult, PublishResult } from "./types";
import { createWorkflowSnapshot } from "./versioning";
import {
  updateWorkflow,
  findWorkflowById,
  hydrateSnapshotToWorkflow,
  publishWorkflow,
} from "../persistence/workflow";
import type { WorkflowSnapshot } from "../types";

/**
 * Transitions a workflow from DRAFT to VALIDATED state if it passes validation.
 *
 * @param workflowId - The workflow ID
 * @returns LifecycleTransitionResult
 */
export async function validateWorkflowAction(
  workflowId: string
): Promise<LifecycleTransitionResult> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      nodes: {
        include: {
          tasks: {
            include: {
              outcomes: true,
              crossFlowDependencies: true,
            },
          },
          outboundGates: true,
          inboundGates: true,
        },
      },
      gates: true,
      fanOutRules: true,
    },
  });

  if (!workflow) {
    return {
      success: false,
      from: WorkflowStatus.DRAFT,
      to: WorkflowStatus.VALIDATED,
      error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow not found" },
    };
  }

  if (workflow.status === WorkflowStatus.PUBLISHED) {
    return {
      success: false,
      from: WorkflowStatus.PUBLISHED,
      to: WorkflowStatus.VALIDATED,
      error: { code: "INVALID_STATE", message: "Published workflows cannot be validated again" },
    };
  }

  // Run full validation as if it were VALIDATED to ensure transition is safe
  const validation = await validateWorkflow({
    ...workflow,
    status: WorkflowStatus.VALIDATED,
  } as unknown as WorkflowWithRelations);

  if (!validation.valid) {
    return {
      success: false,
      from: workflow.status,
      to: WorkflowStatus.VALIDATED,
      validation,
      error: { code: "VALIDATION_FAILED", message: "Workflow failed validation" },
    };
  }

  // Update status via gateway
  await updateWorkflow(workflowId, { status: WorkflowStatus.VALIDATED });

  // Fetch updated workflow with relations
  const updated = await findWorkflowById(workflowId);

  return {
    success: true,
    from: workflow.status,
    to: WorkflowStatus.VALIDATED,
    workflow: updated as unknown as WorkflowWithRelations,
    validation,
  };
}

/**
 * Transitions a workflow from VALIDATED to PUBLISHED state.
 * Creates an immutable version snapshot.
 *
 * INV-011: Published workflows are immutable
 *
 * @param workflowId - The workflow ID
 * @param publishedBy - The user ID who is publishing
 * @returns PublishResult
 */
export async function publishWorkflowAction(
  workflowId: string,
  publishedBy: string
): Promise<PublishResult> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      nodes: {
        include: {
          tasks: {
            include: {
              outcomes: true,
              crossFlowDependencies: true,
            },
          },
          outboundGates: true,
          inboundGates: true,
        },
      },
      gates: true,
      fanOutRules: true,
    },
  });

  if (!workflow) {
    return {
      success: false,
      from: WorkflowStatus.DRAFT,
      to: WorkflowStatus.PUBLISHED,
      error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow not found" },
    };
  }

  if (workflow.status !== WorkflowStatus.VALIDATED) {
    return {
      success: false,
      from: workflow.status,
      to: WorkflowStatus.PUBLISHED,
      error: { code: "INVALID_STATE", message: "Workflow must be in VALIDATED state to publish" },
    };
  }

  // Final validation check just in case
  const validation = await validateWorkflow(workflow as unknown as WorkflowWithRelations);
  if (!validation.valid) {
    return {
      success: false,
      from: workflow.status,
      to: WorkflowStatus.PUBLISHED,
      validation,
      error: { code: "VALIDATION_FAILED", message: "Workflow failed validation" },
    };
  }

  const snapshot = createWorkflowSnapshot(workflow as unknown as WorkflowWithRelations);

  // Use gateway to publish (updates status and creates version in transaction)
  const result = await publishWorkflow(
    workflow.id,
    workflow.version,
    snapshot as unknown as WorkflowSnapshot,
    publishedBy
  );

  // Fetch updated workflow with full relations for return
  const fullWorkflow = await findWorkflowById(workflow.id);

  return {
    success: true,
    from: WorkflowStatus.VALIDATED,
    to: WorkflowStatus.PUBLISHED,
    workflow: fullWorkflow as unknown as WorkflowWithRelations,
    versionId: result.version.id,
    version: result.version.version,
  };
}

/**
 * Reverts a VALIDATED workflow back to DRAFT state for editing.
 *
 * @param workflowId - The workflow ID
 * @returns LifecycleTransitionResult
 */
export async function revertToDraftAction(
  workflowId: string
): Promise<LifecycleTransitionResult> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    return {
      success: false,
      from: WorkflowStatus.DRAFT,
      to: WorkflowStatus.DRAFT,
      error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow not found" },
    };
  }

  if (workflow.status !== WorkflowStatus.VALIDATED) {
    return {
      success: false,
      from: workflow.status,
      to: WorkflowStatus.DRAFT,
      error: { code: "INVALID_STATE", message: "Only Validated workflows can be reverted to Draft" },
    };
  }

  // Update status via gateway
  await updateWorkflow(workflowId, { status: WorkflowStatus.DRAFT });

  // Fetch updated workflow with relations
  const updated = await findWorkflowById(workflowId);

  return {
    success: true,
    from: WorkflowStatus.VALIDATED,
    to: WorkflowStatus.DRAFT,
    workflow: updated as unknown as WorkflowWithRelations,
  };
}

/**
 * Creates a new DRAFT workflow by branching from an existing Published version.
 *
 * @param workflowId - The ID of the workflow to branch from
 * @param versionNumber - The version number to branch from
 * @param companyId - The tenant ID
 * @param userId - The user creating the branch
 * @returns LifecycleTransitionResult
 */
export async function branchFromVersion(
  workflowId: string,
  versionNumber: number,
  companyId: string,
  userId: string
): Promise<LifecycleTransitionResult> {
  // Find the version snapshot
  const version = await prisma.workflowVersion.findUnique({
    where: {
      workflowId_version: {
        workflowId,
        version: versionNumber,
      },
    },
  });

  if (!version) {
    return {
      success: false,
      from: WorkflowStatus.PUBLISHED,
      to: WorkflowStatus.DRAFT,
      error: { code: "VERSION_NOT_FOUND", message: "Workflow version not found" },
    };
  }

  const snapshot = version.snapshot as unknown as WorkflowSnapshot;

  // Create a new Draft workflow from the snapshot using shared hydration logic
  const result = await prisma.$transaction(async (tx) => {
    // Determine next version number
    const latestVersion = await tx.workflow.findFirst({
      where: { companyId, name: snapshot.name },
      orderBy: { version: "desc" },
    });

    const nextVersion = (latestVersion?.version ?? snapshot.version) + 1;

    // Use shared hydration function (no provenance for branch)
    return hydrateSnapshotToWorkflow(tx, snapshot, {
      companyId,
      version: nextVersion,
    });
  });

  const fullWorkflow = await findWorkflowById(result.workflowId);

  return {
    success: true,
    from: WorkflowStatus.PUBLISHED,
    to: WorkflowStatus.DRAFT,
    workflow: fullWorkflow as unknown as WorkflowWithRelations,
  };
}
