/**
 * Lifecycle API - Revert to Draft
 *
 * Canon Source: 10_flowspec_engine_contract.md §7 (line 384)
 * "Validated → Draft (via Edit action — reverts for changes)"
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { revertToDraftAction } from "@/lib/flowspec/lifecycle";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Revert a VALIDATED workflow back to DRAFT for editing.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const workflow = await prisma.workflow.findUnique({ where: { id } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    const result = await revertToDraftAction(id);

    if (!result.success) {
      return apiError(
        result.error?.code || "REVERT_FAILED",
        result.error?.message || "Failed to revert workflow to draft"
      );
    }

    return apiSuccess({ workflow: result.workflow });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
