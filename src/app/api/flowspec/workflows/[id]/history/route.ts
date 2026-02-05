/**
 * Draft History API
 * 
 * Returns the history of COMMIT and RESTORE events for a workflow.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { getDraftHistory } from "@/lib/flowspec/persistence/draft-events";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;

    // 1. Verify ownership
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    
    const { companyId } = await verifyTenantOwnership(workflow.companyId);

    // 2. Get history
    const history = await getDraftHistory(workflowId, companyId);

    return apiSuccess({ items: history });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
