/**
 * Actionable Tasks API - Scoped to Flow Group
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 *
 * Enriches tasks with:
 * - _metadata.assignments: Current job assignments
 * - _signals: Policy-derived signals (priority, SLA, due dates)
 *
 * INVARIANT: Canonical ordering unchanged (flowId ASC → taskId ASC → iteration ASC)
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiList, apiError } from "@/lib/api-utils";
import { getActionableTasks } from "@/lib/flowspec/engine";
import { computeEffectivePolicy, computeTaskSignals } from "@/lib/flowspec/policy";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import type { NodeActivation } from "@prisma/client";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * List all Actionable Tasks within a specific Flow Group.
 * Tasks are enriched with signals but canonical ordering is preserved.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: flowGroupId } = await params;

    const flowGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
      include: {
        job: { select: { id: true } }
      }
    });

    if (!flowGroup) {
      return apiError("FLOW_GROUP_NOT_FOUND", "Flow Group not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(flowGroup.companyId);

    // Find all ACTIVE flows in this group with node activations for timing
    const activeFlows = await prisma.flow.findMany({
      where: {
        flowGroupId,
        status: "ACTIVE",
      },
      include: {
        workflowVersion: true,
        nodeActivations: true,
      },
    });

    const groupTasks = [];
    for (const flow of activeFlows) {
      const tasks = await getActionableTasks(flow.id);
      groupTasks.push(...tasks);
    }

    // Fetch current assignments for the job
    let assignments: any[] = [];
    if (flowGroup.job?.id) {
      assignments = await prisma.jobAssignment.findMany({
        where: {
          jobId: flowGroup.job.id,
          supersededAt: null
        },
        include: {
          member: { select: { id: true } },
          externalParty: { select: { id: true, name: true } }
        }
      });
    }

    // Compute effective policy (use first flow's snapshot for policy merge)
    const asOf = new Date();
    let effectivePolicy: Awaited<ReturnType<typeof computeEffectivePolicy>> | null = null;
    
    if (activeFlows.length > 0) {
      // Merge all snapshots' nodes for complete task coverage
      const allNodes = activeFlows.flatMap(f => {
        const snapshot = f.workflowVersion.snapshot as unknown as WorkflowSnapshot;
        return snapshot?.nodes ?? [];
      });
      
      const mergedSnapshot: WorkflowSnapshot = {
        workflowId: "",
        version: 0,
        name: "",
        description: null,
        isNonTerminating: false,
        nodes: allNodes,
        gates: [],
      };
      
      effectivePolicy = await computeEffectivePolicy(flowGroupId, mergedSnapshot);
    }

    // Enrich tasks with _metadata.assignments and _signals
    // INVARIANT: Do NOT reorder - signals are read-only enrichment
    const enrichedTasks = groupTasks.map(task => {
      // Find the flow for this task
      const flow = activeFlows.find(f => f.id === task.flowId);

      // Find node activation time for signal computation
      const nodeActivation = flow?.nodeActivations.find(
        (na: NodeActivation) => na.nodeId === task.nodeId && na.iteration === task.iteration
      );
      const activatedAt = nodeActivation?.activatedAt ?? null;

      // Compute signals
      const signals = effectivePolicy
        ? computeTaskSignals(effectivePolicy, task.taskId, activatedAt, asOf)
        : {
            jobPriority: "NORMAL" as const,
            effectiveSlaHours: null,
            effectiveDueAt: null,
            isOverdue: false,
            isDueSoon: false,
          };

      return {
        ...task,
        _metadata: {
          assignments: assignments.map((a: any) => ({
            slotKey: a.slotKey,
            assigneeType: a.assigneeType,
            assignee: a.member || a.externalParty
          }))
        },
        _signals: signals
      };
    });

    // INVARIANT: Ordering unchanged - already sorted by computeActionableTasks
    // flowId ASC → taskId ASC → iteration ASC (src/lib/flowspec/derived.ts:416-422)

    return apiList(enrichedTasks, enrichedTasks.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
