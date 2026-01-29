/**
 * Template API - Get Single
 *
 * Get a specific workflow template by ID.
 * Templates are read-only; no PATCH or DELETE allowed.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { getTemplate } from "@/lib/flowspec/templates/service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Get a specific template.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { authority } = await getActorTenantContext();
    const { id } = await params;

    const template = await getTemplate(id);

    if (!template) {
      return apiError("TEMPLATE_NOT_FOUND", "Template not found", null, 404);
    }

    return apiSuccess({ template }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

// NOTE: No PATCH or DELETE methods - templates are immutable.
// Updates require creating a new version row.
// This is enforced by guard_flowspec_forbidden_routes.mjs.
