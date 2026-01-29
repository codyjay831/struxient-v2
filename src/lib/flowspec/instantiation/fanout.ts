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
import { updateFlowStatus } from "../truth";

/**
 * Executes fan-out rules for a completed Node and Outcome.
 *
 * INV-023: Fan-out failure preserves Outcome but BLOCKS Flow.
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
  // 1. Find fan-out rules for this node and outcome
  const rules = await prisma.fanOutRule.findMany({
    where: {
      sourceNodeId,
      triggerOutcome,
    },
  });

  if (rules.length === 0) {
    return;
  }

  // 2. Execute each rule
  for (const rule of rules) {
    try {
      // Canon: Resolve to Latest Published version
      const result = await createFlow(
        rule.targetWorkflowId,
        scope,
        companyId,
        flowGroupId
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Unknown instantiation error");
      }
    } catch (error) {
      // 3. Log failure (INV-023)
      await prisma.fanOutFailure.create({
        data: {
          triggeringFlowId,
          triggeringTaskId: "node-complete", // In v2 we trigger at Node level completion
          triggeringOutcome: triggerOutcome,
          targetWorkflowId: rule.targetWorkflowId,
          errorReason: error instanceof Error ? error.message : String(error),
        },
      });

      // 4. Set triggering Flow to BLOCKED state (INV-023)
      await updateFlowStatus(triggeringFlowId, FlowStatus.BLOCKED);
    }
  }
}
