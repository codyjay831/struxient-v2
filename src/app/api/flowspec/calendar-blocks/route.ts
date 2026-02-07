/**
 * Scheduling Blocks API - Get read-only projection of schedule truth
 * Canon: 01_scheduling_invariants_and_guards.canon.md
 */

import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    
    // Fetch non-superseded schedule blocks for the company
    // Tenant isolation enforced by companyId filter
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        companyId,
        supersededAt: null,
      },
      include: {
        // Optional: include change request if needed for future lens logic
        changeRequest: {
          select: {
            status: true,
            reason: true,
          }
        }
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    return apiSuccess({ blocks }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
