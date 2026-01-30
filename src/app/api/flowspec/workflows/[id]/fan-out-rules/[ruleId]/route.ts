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
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";

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

    // INV-026 Enforcement: Auto-revert VALIDATED to DRAFT (Policy B)
    try {
      await ensureDraftForStructuralEdit(workflowId);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
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
