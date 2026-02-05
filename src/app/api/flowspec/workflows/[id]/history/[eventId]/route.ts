/**
 * Save Event Snapshot API
 * 
 * Returns the full snapshot for a specific save event.
 * Used for diffing and restore previews.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { getDraftEvent } from "@/lib/flowspec/persistence/draft-events";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; eventId: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, eventId } = await params;

    // 1. Verify ownership
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    
    const { companyId } = await verifyTenantOwnership(workflow.companyId);

    // 2. Get event
    const event = await getDraftEvent(eventId, companyId);
    if (!event || event.workflowId !== workflowId) {
      return apiError("EVENT_NOT_FOUND", "Save event not found");
    }

    return apiSuccess({ event });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
