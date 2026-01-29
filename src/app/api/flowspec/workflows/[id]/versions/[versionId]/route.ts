/**
 * Version API - Get
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.9
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; versionId: string }>;
};

/**
 * Get a specific Published version snapshot.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, versionId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(workflow.companyId);

    const version = await prisma.workflowVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.workflowId !== workflowId) {
      return apiError("VERSION_NOT_FOUND", "Version not found", null, 404);
    }

    return apiSuccess({ version }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
