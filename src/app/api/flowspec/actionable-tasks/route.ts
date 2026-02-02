/**
 * Actionable Tasks API - Global list for tenant
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
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiList } from "@/lib/api-utils";
import { getActionableTasks } from "@/lib/flowspec/engine";
import { computeEffectivePolicy, computeTaskSignals } from "@/lib/flowspec/policy";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import type { NodeActivation } from "@prisma/client";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * List all Actionable Tasks for the current tenant.
 * Tasks are enriched with signals but canonical ordering is preserved.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();

    // 1. Find all ACTIVE flows for the tenant with workflow version and node activations
    const activeFlows = await prisma.flow.findMany({
      where: {
        workflow: { companyId },
        status: "ACTIVE",
      },
      include: {
        workflowVersion: true,
        nodeActivations: true,
        flowGroup: {
          include: {
            job: {
              select: { id: true }
            }
          }
        }
      }
    });

    // 2. Aggregate actionable tasks and collect jobIds + flowGroupIds
    const allActionableTasks = [];
    const jobIds = new Set<string>();
    const flowGroupIds = new Set<string>();

    for (const flow of activeFlows) {
      const tasks = await getActionableTasks(flow.id);
      allActionableTasks.push(...tasks);
      flowGroupIds.add(flow.flowGroupId);
      if (flow.flowGroup.job?.id) {
        jobIds.add(flow.flowGroup.job.id);
      }
    }

    // 3. Batch fetch current assignments for all relevant jobs
    const assignmentsByJob = new Map<string, any[]>();
    if (jobIds.size > 0) {
      const allAssignments = await prisma.jobAssignment.findMany({
        where: {
          jobId: { in: Array.from(jobIds) },
          supersededAt: null
        },
        include: {
          member: { select: { id: true } },
          externalParty: { select: { id: true, name: true } }
        }
      });

      for (const assignment of allAssignments) {
        const jobList = assignmentsByJob.get(assignment.jobId) || [];
        jobList.push(assignment);
        assignmentsByJob.set(assignment.jobId, jobList);
      }
    }

    // 4. Compute effective policies for all flow groups
    const effectivePolicies = new Map<string, Awaited<ReturnType<typeof computeEffectivePolicy>>>();
    const asOf = new Date(); // Single reference time for all overdue computations

    for (const flow of activeFlows) {
      if (!effectivePolicies.has(flow.flowGroupId)) {
        const snapshot = flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
        const policy = await computeEffectivePolicy(flow.flowGroupId, snapshot);
        effectivePolicies.set(flow.flowGroupId, policy);
      }
    }

    // Build a lookup for flow data
    const flowDataMap = new Map<string, { 
      jobId: string | undefined; 
      nodeActivations: NodeActivation[];
    }>();
    for (const flow of activeFlows) {
      flowDataMap.set(flow.id, {
        jobId: flow.flowGroup.job?.id,
        nodeActivations: flow.nodeActivations,
      });
    }

    // 5. Enrich tasks with _metadata.assignments and _signals
    // INVARIANT: Do NOT reorder - signals are read-only enrichment
    const enrichedTasks = allActionableTasks.map(task => {
      // Find the flow data
      const flowData = flowDataMap.get(task.flowId);
      const jobId = flowData?.jobId;
      const assignments = jobId ? assignmentsByJob.get(jobId) || [] : [];

      // Get effective policy for this flow group
      const effectivePolicy = effectivePolicies.get(task.flowGroupId);

      // Find node activation time for signal computation
      const nodeActivation = flowData?.nodeActivations.find(
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
