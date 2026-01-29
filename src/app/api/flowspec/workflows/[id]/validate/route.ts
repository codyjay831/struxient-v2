/**
 * Lifecycle API - Validate
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.9
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { validateWorkflowAction } from "@/lib/flowspec/lifecycle";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Validate a Workflow.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const workflow = await prisma.workflow.findUnique({ where: { id } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    const result = await validateWorkflowAction(id);

    if (!result.success) {
      return apiError(
        result.error?.code || "VALIDATION_FAILED",
        result.error?.message || "Validation failed",
        result.validation?.errors
      );
    }

    return apiSuccess({ valid: true, workflow: result.workflow });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
