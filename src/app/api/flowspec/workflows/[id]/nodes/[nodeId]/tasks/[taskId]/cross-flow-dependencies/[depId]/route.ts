/**
 * Cross-Flow Dependency API - Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.7
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string; taskId: string; depId: string }>;
};

/**
 * Delete a Cross-Flow Dependency.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, taskId, depId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    const dependency = await prisma.crossFlowDependency.findUnique({ where: { id: depId } });
    if (!dependency || dependency.taskId !== taskId) {
      return apiError("DEPENDENCY_NOT_FOUND", "Dependency not found", null, 404);
    }

    await prisma.crossFlowDependency.delete({ where: { id: depId } });

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
