/**
 * FlowGroup Snapshot Tasks API
 * 
 * Returns a flattened list of tasks from the bound workflow snapshots
 * of all active flows in a Flow Group. Used for Policy SLA overrides.
 * 
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Get all tasks from the bound workflow versions of a Flow Group.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: flowGroupId } = await params;

    const flowGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
    });

    if (!flowGroup) {
      return apiError("FLOW_GROUP_NOT_FOUND", "Flow Group not found", null, 404);
    }

    await verifyTenantOwnership(flowGroup.companyId);

    // Find all flows in this group with their bound workflow version snapshot
    const flows = await prisma.flow.findMany({
      where: { flowGroupId },
      include: {
        workflowVersion: {
          select: {
            snapshot: true
          }
        }
      }
    });

    // Extract unique tasks across all flow snapshots
    // ASSUMPTION: In v1 Policy, taskId is the unique key for overrides within a FlowGroup.
    // If multiple flows (e.g. from fan-out) share a taskId, they share the same SLA override.
    // Deduplication by taskId locks this scope per INV-033.
    const tasksMap = new Map<string, { taskId: string; taskName: string; defaultSlaHours: number | null }>();

    for (const flow of flows) {
      const snapshot = flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
      if (snapshot?.nodes) {
        for (const node of snapshot.nodes) {
          if (node.tasks) {
            for (const task of node.tasks) {
              if (!tasksMap.has(task.id)) {
                tasksMap.set(task.id, {
                  taskId: task.id,
                  taskName: task.name,
                  defaultSlaHours: task.defaultSlaHours ?? null
                });
              }
            }
          }
        }
      }
    }

    const tasks = Array.from(tasksMap.values());

    return apiSuccess({ tasks }, 200);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
