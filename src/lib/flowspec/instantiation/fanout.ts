/**
 * FlowSpec Fan-out Execution
 * 
 * Canon Source: 10_flowspec_engine_contract.md §10.3
 * 
 * Fan-out occur when a single Outcome triggers the creation or activation of multiple Flows.
 * All target Workflows are resolved to their Latest Published version.
 */

import { prisma } from "../../prisma";
import { FlowStatus } from "@prisma/client";
import { createFlow } from "./index";
import type { Scope } from "../types";
import { updateFlowStatus, getAnchorIdentity, getSaleDetails } from "../truth";
import { resolveBundleWorkflows } from "./bundles";

/**
 * Executes fan-out rules for a completed Node and Outcome.
 * 
 * INV-023: Fan-out failure preserves Outcome but BLOCKED Flow.
 * 
 * @param triggeringFlowId - The Flow ID that triggered fan-out
 * @param sourceNodeId - The Node that completed
 * @param triggerOutcome - The recorded outcome name
 * @param scope - The unit of work identifier
 * @param companyId - The tenant ID
 * @param flowGroupId - The current Flow Group ID
 */
export async function executeFanOut(
  triggeringFlowId: string,
  sourceNodeId: string,
  triggerOutcome: string,
  scope: Scope,
  companyId: string,
  flowGroupId: string
): Promise<void> {
  // 1. Special Side-Effect: provisionJob
  // Triggered by SALE_CLOSED outcome
  if (triggerOutcome === "SALE_CLOSED") {
    try {
      await provisionJob(triggeringFlowId, flowGroupId, companyId);
    } catch (error) {
      console.error(`[ProvisionJob Error] FlowGroup ${flowGroupId}:`, error);
      await updateFlowStatus(triggeringFlowId, FlowStatus.BLOCKED);
      return; // Stop further fan-out if provisioning fails
    }
  }

  // 2. Find fan-out rules for this node and outcome
  const rules = await prisma.fanOutRule.findMany({
    where: {
      sourceNodeId,
      triggerOutcome,
    },
  });

  if (rules.length === 0) {
    return;
  }

  // 3. Execute each rule
  for (const rule of rules) {
    try {
      // Duplicate Policy C1: One Flow per WorkflowId per FlowGroup (skip if any flow exists)
      const existingFlow = await prisma.flow.findFirst({
        where: {
          flowGroupId,
          workflowId: rule.targetWorkflowId,
        },
      });

      if (existingFlow) {
        console.log(`[FanOut Skip] Flow for workflow ${rule.targetWorkflowId} already exists in group ${flowGroupId}`);
        continue;
      }

      // Canon: Resolve to Latest Published version
      const result = await createFlow(
        rule.targetWorkflowId,
        scope,
        companyId,
        { flowGroupId }
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Unknown instantiation error");
      }
    } catch (error) {
      // 4. Log failure (INV-023)
      await prisma.fanOutFailure.create({
        data: {
          triggeringFlowId,
          triggeringTaskId: "node-complete",
          triggeringOutcome: triggerOutcome,
          targetWorkflowId: rule.targetWorkflowId,
          errorReason: error instanceof Error ? error.message : String(error),
        },
      });

      // 5. Set triggering Flow to BLOCKED state (INV-023)
      await updateFlowStatus(triggeringFlowId, FlowStatus.BLOCKED);
      break; // Stop execution on first failure to maintain predictable state
    }
  }
}

/**
 * Handles Job provisioning and downstream workflow instantiation.
 * 
 * Logic:
 * 1. Load SaleDetails from the current task evidence.
 * 2. Load Anchor Identity from the FlowGroup.
 * 3. Verify customerId match.
 * 4. Create Job if missing (idempotent).
 * 5. Instantiate downstream workflows from bundle.
 */
async function provisionJob(
  flowId: string,
  flowGroupId: string,
  companyId: string
): Promise<void> {
  // 1. Load SaleDetails
  // We need the taskId that recorded SALE_CLOSED. 
  // We'll look for the latest task execution with outcome SALE_CLOSED on this flow.
  const taskExecution = await prisma.taskExecution.findFirst({
    where: {
      flowId,
      outcome: "SALE_CLOSED",
    },
    orderBy: { outcomeAt: "desc" },
  });

  if (!taskExecution) {
    throw new Error("Could not find task execution with outcome SALE_CLOSED");
  }

  const saleDetails = await getSaleDetails(flowId, taskExecution.taskId);
  if (!saleDetails || !saleDetails.serviceAddress) {
    throw new Error("SALE_CLOSED recorded but required SaleDetails evidence (with serviceAddress) is missing");
  }

  // 2. Load Anchor Identity
  const anchorIdentity = await getAnchorIdentity(flowGroupId);
  if (!anchorIdentity) {
    throw new Error("FlowGroup has no Anchor Identity evidence");
  }

  // 3. Verify Mismatch
  if (anchorIdentity.customerId !== saleDetails.customerId) {
    throw new Error(`CUSTOMER_MISMATCH: Anchor customer ${anchorIdentity.customerId} does not match sale customer ${saleDetails.customerId}`);
  }

  // 4. Create Job if missing (idempotent skip)
  const existingJob = await prisma.job.findUnique({
    where: { flowGroupId },
  });

  if (!existingJob) {
    await prisma.job.create({
      data: {
        companyId,
        customerId: saleDetails.customerId,
        flowGroupId,
        address: saleDetails.serviceAddress,
      },
    });
    console.log(`[ProvisionJob] Created Job for FlowGroup ${flowGroupId}`);
  }

  // 5. Instantiate downstream bundles (Pattern B)
  if (saleDetails.packageId) {
    const workflowIds = resolveBundleWorkflows(saleDetails.packageId);
    for (const targetWfId of workflowIds) {
      // Respect Duplicate Policy C1
      const exists = await prisma.flow.findFirst({
        where: { flowGroupId, workflowId: targetWfId },
      });
      if (exists) continue;

      const flowGroup = await prisma.flowGroup.findUnique({
        where: { id: flowGroupId },
        select: { scopeType: true, scopeId: true },
      });

      if (!flowGroup) continue;

      await createFlow(targetWfId, { type: flowGroup.scopeType, id: flowGroup.scopeId }, companyId, { flowGroupId });
    }
  }
}
