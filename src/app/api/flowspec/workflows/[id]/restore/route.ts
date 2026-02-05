/**
 * Restore Draft API
 * 
 * Restores the workflow to a previous state from a Save Event.
 * Creates a RESTORE event in the history.
 * Replaces the current WIP buffer with the restored snapshot.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { getDraftEvent, createRestoreEvent } from "@/lib/flowspec/persistence/draft-events";
import { upsertDraftBuffer } from "@/lib/flowspec/persistence/draft-buffer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { eventId } = body;

    if (!eventId) return apiError("INVALID_REQUEST", "Event ID is required");

    // 1. Verify ownership and get event
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    
    const { companyId, userId } = await verifyTenantOwnership(workflow.companyId);

    const targetEvent = await getDraftEvent(eventId, companyId);
    if (!targetEvent || targetEvent.workflowId !== workflowId) {
      return apiError("EVENT_NOT_FOUND", "Save event not found");
    }

    const restoredSnapshot = targetEvent.snapshot as any;

    // 2. Execute Restore in a transaction
    await prisma.$transaction(async (tx) => {
      // A. Create RESTORE event (allocates seq transactionally)
      // Capture current relational state for the "snapshot archived away from"
      const currentNodes = await tx.node.findMany({
        where: { workflowId },
        select: { id: true, position: true }
      });
      
      // We need the semantic state too. For simplicity, we'll fetch it.
      // In a real scenario, we might want a full snapshot here.
      
      await createRestoreEvent(tx, {
        workflowId,
        companyId,
        snapshot: targetEvent.snapshot, // The state we are restoring TO
        restoresEventId: eventId,
        userId,
      });

      // B. Update buffer with restored content
      // Note: WorkflowDraftBuffer.content expects semantic only, but event.snapshot is composite.
      // We should extract semantic part if they are different.
      const { layout, ...semanticPart } = restoredSnapshot;

      await tx.workflowDraftBuffer.upsert({
        where: { companyId_workflowId: { companyId, workflowId } },
        create: {
          companyId,
          workflowId,
          content: semanticPart as any,
          updatedBy: userId,
          baseEventId: eventId,
        },
        update: {
          content: semanticPart as any,
          updatedBy: userId,
          baseEventId: eventId,
        },
      });
      
      // Note: Layout (Node positions) are NOT automatically updated in relational tables 
      // during restore-to-buffer. The user must COMMIT the buffer to make the restored 
      // semantic state "real". For layout, we might need a separate "Apply layout" logic 
      // or include it in the Commit.
    });

    return apiSuccess({ message: "Workflow restored to buffer. Review and commit to apply." });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
