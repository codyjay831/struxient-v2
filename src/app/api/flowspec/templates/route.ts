/**
 * Templates API - List
 *
 * List available workflow templates for import.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiList } from "@/lib/api-utils";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { listTemplates, getTradeKeys } from "@/lib/flowspec/templates/service";

export const dynamic = "force-dynamic";

/**
 * List available workflow templates.
 * Optionally filter by trade key.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authenticated user (templates are readable by any company member)
    const { authority } = await getActorTenantContext();

    const { searchParams } = new URL(request.url);
    const tradeKey = searchParams.get("trade") || undefined;
    const includeFixtures = searchParams.get("fixtures") === "true";

    const templates = await listTemplates(tradeKey, includeFixtures);
    const trades = await getTradeKeys();

    return apiSuccess({ templates, trades }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
