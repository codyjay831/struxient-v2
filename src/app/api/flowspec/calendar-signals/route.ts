/**
 * Scheduling Signals API - Get derived advisory conflicts and alerts
 * Canon: 01_scheduling_invariants_and_guards.canon.md
 * Phase F0: Minimal derived signals.
 */

import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { deriveSchedulingSignals } from "@/lib/flowspec/scheduling-analysis";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    
    // Fetch active blocks and pending requests for the tenant
    const [blocks, requests] = await Promise.all([
      prisma.scheduleBlock.findMany({
        where: {
          companyId,
          supersededAt: null,
        }
      }),
      prisma.scheduleChangeRequest.findMany({
        where: {
          companyId,
          status: 'PENDING',
        }
      })
    ]);

    const signals = deriveSchedulingSignals(blocks, requests);

    return apiSuccess({ signals }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
