/**
 * Tenancy Me API - Get current actor's member context
 */

import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { memberId, companyId, authority } = await getActorTenantContext();
    return apiSuccess({ memberId, companyId }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
