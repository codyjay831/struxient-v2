/**
 * Discard Draft API
 * 
 * Wipes the current WIP buffer, effectively discarding all unsaved semantic changes.
 * Does NOT touch the relational tables (Node positions/Layout).
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { deleteDraftBuffer, getDraftBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;

    // 1. Verify ownership and get buffer
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    
    const { companyId } = await verifyTenantOwnership(workflow.companyId);

    const buffer = await getDraftBuffer(workflowId, companyId);
    if (!buffer) {
      return apiError("NO_CHANGES", "No unsaved changes found to discard");
    }

    // 2. Delete the buffer
    await deleteDraftBuffer(workflowId, companyId);

    return apiSuccess({ message: "Draft changes discarded successfully" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
