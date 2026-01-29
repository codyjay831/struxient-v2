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

  // Run full validation
  const validation = await validateWorkflow(workflow as unknown as WorkflowWithRelations);

  if (!validation.valid) {
    return {
      success: false,
      from: workflow.status,
      to: WorkflowStatus.VALIDATED,
      validation,
      error: { code: "VALIDATION_FAILED", message: "Workflow failed validation" },
    };
  }

  // Update status
  const updated = await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: WorkflowStatus.VALIDATED },
    include: {
      nodes: { include: { tasks: { include: { outcomes: true } } } },
      gates: true,
    },
  });

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

  // Use a transaction to update status and create version
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create WorkflowVersion
    const version = await tx.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: workflow.version,
        snapshot: snapshot as any,
        publishedBy,
      },
    });

    // 2. Update Workflow status and publishedAt
    const updated = await tx.workflow.update({
      where: { id: workflow.id },
      data: {
        status: WorkflowStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true } } } },
        gates: true,
      },
    });

    return { updated, version };
  });

  return {
    success: true,
    from: WorkflowStatus.VALIDATED,
    to: WorkflowStatus.PUBLISHED,
    workflow: result.updated as unknown as WorkflowWithRelations,
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

  const updated = await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: WorkflowStatus.DRAFT },
    include: {
      nodes: { include: { tasks: { include: { outcomes: true } } } },
      gates: true,
    },
  });

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

  const snapshot = version.snapshot as any;

  // Create a new Draft workflow from the snapshot
  // This involves re-creating all nodes, tasks, outcomes, and gates
  const newWorkflow = await prisma.$transaction(async (tx) => {
    // 1. Create the new Workflow record
    // We increment the version for the new draft
    const latestVersion = await tx.workflow.findFirst({
      where: { companyId, name: snapshot.name },
      orderBy: { version: "desc" },
    });

    const nextVersion = (latestVersion?.version ?? snapshot.version) + 1;

    const wf = await tx.workflow.create({
      data: {
        name: snapshot.name,
        description: snapshot.description,
        companyId,
        version: nextVersion,
        status: WorkflowStatus.DRAFT,
        isNonTerminating: snapshot.isNonTerminating,
      },
    });

    // Maps to track ID translation
    const nodeIdMap = new Map<string, string>();
    const taskIdMap = new Map<string, string>();

    // 2. Create Nodes and Tasks
    for (const sNode of snapshot.nodes) {
      const newNode = await tx.node.create({
        data: {
          workflowId: wf.id,
          name: sNode.name,
          isEntry: sNode.isEntry,
          completionRule: sNode.completionRule,
          specificTasks: [], // Will update after tasks are created
        },
      });
      nodeIdMap.set(sNode.id, newNode.id);

      for (const sTask of sNode.tasks) {
        const newTask = await tx.task.create({
          data: {
            nodeId: newNode.id,
            name: sTask.name,
            instructions: sTask.instructions,
            evidenceRequired: sTask.evidenceRequired,
            evidenceSchema: sTask.evidenceSchema as any,
            displayOrder: sTask.displayOrder,
          },
        });
        taskIdMap.set(sTask.id, newTask.id);

        for (const sOutcome of sTask.outcomes) {
          await tx.outcome.create({
            data: {
              taskId: newTask.id,
              name: sOutcome.name,
            },
          });
        }
      }
    }

    // 3. Update specificTasks for nodes (now that we have new task IDs)
    for (const sNode of snapshot.nodes) {
      if (sNode.specificTasks.length > 0) {
        const newSpecificTasks = sNode.specificTasks
          .map((oldId: string) => taskIdMap.get(oldId))
          .filter(Boolean) as string[];

        await tx.node.update({
          where: { id: nodeIdMap.get(sNode.id) },
          data: { specificTasks: newSpecificTasks },
        });
      }
    }

    // 4. Create Gates
    for (const sGate of snapshot.gates) {
      await tx.gate.create({
        data: {
          workflowId: wf.id,
          sourceNodeId: nodeIdMap.get(sGate.sourceNodeId)!,
          outcomeName: sGate.outcomeName,
          targetNodeId: sGate.targetNodeId ? nodeIdMap.get(sGate.targetNodeId) : null,
        },
      });
    }

    return wf;
  });

  const fullWorkflow = await prisma.workflow.findUnique({
    where: { id: newWorkflow.id },
    include: {
      nodes: { include: { tasks: { include: { outcomes: true } } } },
      gates: true,
    },
  });

  return {
    success: true,
    from: WorkflowStatus.PUBLISHED,
    to: WorkflowStatus.DRAFT,
    workflow: fullWorkflow as unknown as WorkflowWithRelations,
  };
}
