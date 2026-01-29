/**
 * Actionable Tasks API - Global list for tenant
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiList } from "@/lib/api-utils";
import { getActionableTasks } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * List all Actionable Tasks for the current tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();

    // 1. Find all ACTIVE flows for the tenant
    const activeFlows = await prisma.flow.findMany({
      where: {
        workflow: { companyId },
        status: "ACTIVE",
      },
      select: { id: true },
    });

    // 2. Aggregate actionable tasks from each flow
    // In a real system, this might be optimized with a materialized view or dedicated table,
    // but per v2 rules, we compute derived state on demand.
    const allActionableTasks = [];
    for (const flow of activeFlows) {
      const tasks = await getActionableTasks(flow.id);
      allActionableTasks.push(...tasks);
    }

    return apiList(allActionableTasks, allActionableTasks.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
