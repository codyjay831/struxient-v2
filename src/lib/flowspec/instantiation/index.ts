/**
 * FlowSpec Flow Instantiation
 *
 * Canon Source: 10_flowspec_engine_contract.md §10, 00_flowspec_glossary.md §2.3
 */

import { prisma } from "../../prisma";
import { WorkflowStatus, FlowStatus, EvidenceType } from "@prisma/client";
import type { Scope, WorkflowSnapshot, SnapshotNode, SnapshotTask } from "../types";
import { getOrCreateFlowGroup, verifyFlowGroupScopeMatch } from "./scope";
import { activateEntryNodes } from "../engine";

export interface CreateFlowResult {
  success: boolean;
  flowId?: string;
  flowGroupId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Resolves the deterministic Anchor Task within the entry nodes.
 * Rule: Lowest displayOrder among all tasks in entry nodes, then lexicographical ID.
 */
function findAnchorTask(snapshot: WorkflowSnapshot): SnapshotTask | undefined {
  const entryNodes = snapshot.nodes.filter(n => n.isEntry);
  const allEntryTasks = entryNodes.flatMap(n => n.tasks);
  
  if (allEntryTasks.length === 0) return undefined;
  
  return [...allEntryTasks].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Creates a new Flow instance from a Published Workflow.
 *
 * INV-010: Flow bound to version at creation time.
 * INV-011: Only Published Workflows can create Flows.
 *
 * @param workflowId - The ID of the workflow to instantiate
 * @param scope - The unit of work identifier
 * @param companyId - The tenant ID
 * @param options - Optional flowGroupId hint and initial evidence (Anchor Identity)
 * @param tx - Optional Prisma transaction client
 * @returns CreateFlowResult
 */
export async function createFlow(
  workflowId: string,
  scope: Scope,
  companyId: string,
  options: {
    flowGroupId?: string;
    initialEvidence?: {
      data: unknown;
      attachedBy: string;
    };
  } = {},
  tx?: any
): Promise<CreateFlowResult> {
  const client = tx || prisma;
  const { flowGroupId, initialEvidence } = options;

  // 1. Load Workflow and check status
  const workflow = await client.workflow.findUnique({
    where: { id: workflowId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!workflow) {
    return {
      success: false,
      error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow not found" },
    };
  }

  if (workflow.status !== WorkflowStatus.PUBLISHED) {
    return {
      success: false,
      error: {
        code: "WORKFLOW_NOT_PUBLISHED",
        message: "Only Published workflows can be instantiated",
      },
    };
  }

  const latestVersion = workflow.versions[0];
  if (!latestVersion) {
    return {
      success: false,
      error: {
        code: "NO_PUBLISHED_VERSION",
        message: "Workflow is marked Published but has no version snapshot",
      },
    };
  }

  const snapshot = latestVersion.snapshot as unknown as WorkflowSnapshot;

  // 2. Entry Evidence Schema Guard (if initialEvidence provided)
  let anchorTask: SnapshotTask | undefined;
  if (initialEvidence) {
    anchorTask = findAnchorTask(snapshot);
    if (!anchorTask) {
      return {
        success: false,
        error: {
          code: "ANCHOR_TASK_MISSING",
          message: "Workflow entry node has no tasks to receive Anchor Identity",
        },
      };
    }
  }

  // 3. Manage Flow Group membership via Scope
  if (flowGroupId) {
    const isMatch = await verifyFlowGroupScopeMatch(flowGroupId, companyId, scope, client);
    if (!isMatch) {
      return {
        success: false,
        error: {
          code: "SCOPE_MISMATCH",
          message: "Provided flowGroupId does not match the unit of work (Scope)",
        },
      };
    }
  }

  const flowGroup = await getOrCreateFlowGroup(companyId, scope, client);

  // 4. Duplicate Policy C1: One Flow per WorkflowId per FlowGroup (skip if any flow exists)
  const existingFlow = await client.flow.findFirst({
    where: {
      flowGroupId: flowGroup.id,
      workflowId: workflow.id,
    },
  });

  if (existingFlow) {
    return {
      success: true, // Idempotent success
      flowId: existingFlow.id,
      flowGroupId: flowGroup.id,
    };
  }

  // 5. Create Flow instance and initial evidence atomically
  // INV-010: Permanently bind to this version
  const now = new Date();
  
  // Internal helper for flow creation
  const executeInstantiation = async (t: any) => {
    const flow = await t.flow.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: latestVersion.id,
        flowGroupId: flowGroup.id,
        status: FlowStatus.ACTIVE,
      },
    });

    // Write Anchor Identity evidence if provided
    if (initialEvidence && anchorTask) {
      await t.evidenceAttachment.create({
        data: {
          flowId: flow.id,
          taskId: anchorTask.id,
          type: EvidenceType.STRUCTURED,
          data: { content: initialEvidence.data } as any,
          attachedBy: initialEvidence.attachedBy,
          attachedAt: now,
        },
      });
    }

    // 5. Activate Entry Node(s) - INSIDE transaction for atomicity
    await activateEntryNodes(flow.id, snapshot, t, now);

    return flow;
  };

  const flow = tx ? await executeInstantiation(tx) : await prisma.$transaction(executeInstantiation);

  return {
    success: true,
    flowId: flow.id,
    flowGroupId: flowGroup.id,
  };
}
