/**
 * Fan-Out Rule API - Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.8
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; ruleId: string }>;
};

/**
 * Delete a Fan-Out Rule.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, ruleId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    const rule = await prisma.fanOutRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.workflowId !== workflowId) {
      return apiError("RULE_NOT_FOUND", "Fan-out rule not found", null, 404);
    }

    await prisma.fanOutRule.delete({ where: { id: ruleId } });

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
