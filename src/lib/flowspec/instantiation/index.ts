/**
 * FlowSpec Flow Instantiation
 *
 * Canon Source: 10_flowspec_engine_contract.md §10, 00_flowspec_glossary.md §2.3
 */

import { prisma } from "../../prisma";
import { WorkflowStatus, FlowStatus } from "@prisma/client";
import type { Scope, WorkflowSnapshot, FlowWithRelations } from "../types";
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
 * Creates a new Flow instance from a Published Workflow.
 *
 * INV-010: Flow bound to version at creation time.
 * INV-011: Only Published Workflows can create Flows.
 *
 * @param workflowId - The ID of the workflow to instantiate
 * @param scope - The unit of work identifier
 * @param flowGroupId - Optional flowGroupId hint
 * @param companyId - The tenant ID
 * @returns CreateFlowResult
 */
export async function createFlow(
  workflowId: string,
  scope: Scope,
  companyId: string,
  flowGroupId?: string
): Promise<CreateFlowResult> {
  // 1. Load Workflow and check status
  const workflow = await prisma.workflow.findUnique({
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

  // 2. Manage Flow Group membership via Scope
  if (flowGroupId) {
    const isMatch = await verifyFlowGroupScopeMatch(flowGroupId, companyId, scope);
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

  const flowGroup = await getOrCreateFlowGroup(companyId, scope);

  // 3. Create Flow instance
  // INV-010: Permanently bind to this version
  const flow = await prisma.flow.create({
    data: {
      workflowId: workflow.id,
      workflowVersionId: latestVersion.id,
      flowGroupId: flowGroup.id,
      status: FlowStatus.ACTIVE,
    },
  });

  // 4. Activate Entry Node(s)
  const snapshot = latestVersion.snapshot as unknown as WorkflowSnapshot;
  await activateEntryNodes(flow.id, snapshot);

  return {
    success: true,
    flowId: flow.id,
    flowGroupId: flowGroup.id,
  };
}
