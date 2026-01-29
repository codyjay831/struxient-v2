/**
 * Lifecycle API - Branch
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.9
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { branchFromVersion } from "@/lib/flowspec/lifecycle";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; versionId: string }>;
};

/**
 * Create a new Draft from a Published version.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, versionId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const companyId = await verifyTenantOwnership(workflow.companyId);

    const session = await auth();
    if (!session.userId) {
      return apiError("AUTHENTICATION_REQUIRED", "Authentication required", null, 401);
    }

    const version = await prisma.workflowVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.workflowId !== workflowId) {
      return apiError("VERSION_NOT_FOUND", "Version not found", null, 404);
    }

    const result = await branchFromVersion(
      workflowId,
      version.version,
      companyId,
      session.userId
    );

    if (!result.success) {
      return apiError(
        result.error?.code || "BRANCH_FAILED",
        result.error?.message || "Branch failed"
      );
    }

    return apiSuccess({ workflow: result.workflow }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
