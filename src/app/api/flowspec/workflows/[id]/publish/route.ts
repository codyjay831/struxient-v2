/**
 * Lifecycle API - Publish
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.9
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { publishWorkflowAction } from "@/lib/flowspec/lifecycle";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Publish a Workflow.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const workflow = await prisma.workflow.findUnique({ where: { id } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    const result = await publishWorkflowAction(id, session.userId);

    if (!result.success) {
      return apiError(
        result.error?.code || "PUBLISH_FAILED",
        result.error?.message || "Publish failed",
        result.validation?.errors
      );
    }

    return apiSuccess({
      success: true,
      workflow: result.workflow,
      versionId: result.versionId,
      version: result.version,
    });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
