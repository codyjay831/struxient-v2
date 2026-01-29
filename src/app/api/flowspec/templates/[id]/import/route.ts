/**
 * Template Import API
 *
 * Import a workflow template into the tenant's workspace.
 * Creates a new DRAFT workflow with template provenance.
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { importTemplate } from "@/lib/flowspec/templates/service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Import a template into the current tenant's workspace.
 * Creates a new DRAFT workflow owned by the tenant.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const tenantCtx = await getActorTenantContext();
    const session = await auth();
    const { id: templateId } = await params;

    if (!session.userId) {
      return apiError("UNAUTHORIZED", "Authentication required", null, 401);
    }

    const result = await importTemplate(templateId, tenantCtx, session.userId);

    if (!result.success) {
      const status = result.error?.code === "TEMPLATE_NOT_FOUND" ? 404 : 422;
      return apiError(
        result.error?.code || "IMPORT_FAILED",
        result.error?.message || "Failed to import template",
        null,
        status
      );
    }

    return apiSuccess(
      {
        workflowId: result.workflowId,
        message: "Template imported successfully. Workflow created as DRAFT.",
      },
      201,
      tenantCtx.authority
    );
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
