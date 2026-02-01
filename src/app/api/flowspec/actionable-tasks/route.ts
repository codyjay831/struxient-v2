/**
 * Actionable Tasks API - Global list for tenant
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiList } from "@/lib/api-utils";
import { getActionableTasks } from "@/lib/flowspec/engine";
import { getCurrentJobAssignments } from "@/lib/responsibility/operations";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * List all Actionable Tasks for the current tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();

    // 1. Find all ACTIVE flows for the tenant, include jobId via flowGroup
    const activeFlows = await prisma.flow.findMany({
      where: {
        workflow: { companyId },
        status: "ACTIVE",
      },
      include: {
        flowGroup: {
          include: {
            job: {
              select: { id: true }
            }
          }
        }
      }
    });

    // 2. Aggregate actionable tasks and collect jobIds
    const allActionableTasks = [];
    const jobIds = new Set<string>();

    for (const flow of activeFlows) {
      const tasks = await getActionableTasks(flow.id);
      allActionableTasks.push(...tasks);
      if (flow.flowGroup.job?.id) {
        jobIds.add(flow.flowGroup.job.id);
      } else {
        // console.log(`Phase 2 Debug: Flow ${flow.id} has no jobId in flowGroup`, flow.flowGroup);
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

    // 4. Enrich tasks with _metadata.assignments
    const enrichedTasks = allActionableTasks.map(task => {
      // Find the flow and its jobId
      const flow = activeFlows.find(f => f.id === task.flowId);
      const jobId = flow?.flowGroup.job?.id;
      const assignments = jobId ? assignmentsByJob.get(jobId) || [] : [];

      return {
        ...task,
        _metadata: {
          assignments: assignments.map(a => ({
            slotKey: a.slotKey,
            assigneeType: a.assigneeType,
            assignee: a.member || a.externalParty
          }))
        }
      };
    });

    return apiList(enrichedTasks, enrichedTasks.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
