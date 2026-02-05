/**
 * Commit Draft API
 * 
 * Commits the current WIP buffer to the canonical relational tables.
 * Creates a COMMIT event in the history.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { getDraftBuffer } from "@/lib/flowspec/persistence/draft-buffer";
import { createCommitEvent } from "@/lib/flowspec/persistence/draft-events";
import { commitDraftToWorkflow } from "@/lib/flowspec/persistence/workflow";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { label } = body;

    // 1. Verify ownership and get buffer
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    
    const { companyId, userId } = await verifyTenantOwnership(workflow.companyId);

    const buffer = await getDraftBuffer(workflowId, companyId);
    if (!buffer) {
      return apiError("NO_CHANGES", "No unsaved changes found to commit");
    }

    const content = buffer.content as any;

    // 2. Execute Commit in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // A. Create COMMIT event (allocates seq transactionally)
      // We need to fetch node positions from current relational state for the composite snapshot
      const currentNodes = await tx.node.findMany({
        where: { workflowId },
        select: { id: true, position: true }
      });
      
      const compositeSnapshot = {
        ...content,
        layout: currentNodes.map(n => ({ id: n.id, position: n.position }))
      };

      const event = await createCommitEvent(tx, {
        workflowId,
        companyId,
        snapshot: compositeSnapshot,
        label,
        userId,
      });

      // B. Apply buffer to relational tables
      // We'll reuse the logic from persistence/workflow.ts but within this transaction
      await commitDraftToWorkflow(workflowId, companyId, content, userId, tx);

      // C. Update buffer baseEventId
      await tx.workflowDraftBuffer.update({
        where: { id: buffer.id },
        data: { baseEventId: event.id }
      });

      return { eventId: event.id, seq: event.seq };
    });

    return apiSuccess({ 
      message: "Changes committed successfully",
      ...result
    });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
