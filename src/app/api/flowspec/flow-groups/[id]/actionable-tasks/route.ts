/**
 * Actionable Tasks API - Scoped to Flow Group
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiList, apiError } from "@/lib/api-utils";
import { getActionableTasks } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * List all Actionable Tasks within a specific Flow Group.
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

    const { authority } = await verifyTenantOwnership(flowGroup.companyId);

    // Find all ACTIVE flows in this group
    const activeFlows = await prisma.flow.findMany({
      where: {
        flowGroupId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    const groupTasks = [];
    for (const flow of activeFlows) {
      const tasks = await getActionableTasks(flow.id);
      groupTasks.push(...tasks);
    }

    return apiList(groupTasks, groupTasks.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
