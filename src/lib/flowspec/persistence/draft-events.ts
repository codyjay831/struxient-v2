/**
 * FlowSpec Builder Draft Events Persistence
 * 
 * Handles append-only history of saved/committed draft events.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { DraftEventType } from "@prisma/client";

/**
 * List history of draft events for a workflow.
 */
export async function getDraftHistory(workflowId: string, companyId: string) {
  return prisma.workflowDraftEvent.findMany({
    where: { workflowId, companyId },
    orderBy: { seq: "desc" },
    select: {
      id: true,
      seq: true,
      type: true,
      label: true,
      createdAt: true,
      createdBy: true,
    },
  });
}

/**
 * Get a specific draft event with its snapshot.
 */
export async function getDraftEvent(eventId: string, companyId: string) {
  const event = await prisma.workflowDraftEvent.findUnique({
    where: { id: eventId },
  });

  if (!event || event.companyId !== companyId) return null;
  return event;
}

/**
 * Allocate the next sequence number for a workflow's draft events.
 * MUST be called within a transaction that creates the event.
 */
export async function getNextDraftSeq(
  tx: any, // Prisma.TransactionClient
  workflowId: string
): Promise<number> {
  // Use SELECT FOR UPDATE to ensure serializable-like behavior for seq allocation
  // We lock the Workflow row to prevent concurrent seq allocation for the same workflow.
  
  await tx.$executeRaw`
    SELECT id FROM "Workflow" 
    WHERE id = ${workflowId}
    FOR UPDATE
  `;

  const result = await tx.workflowDraftEvent.aggregate({
    _max: { seq: true },
    where: { workflowId }
  });
  
  return (result._max.seq || 0) + 1;
}

/**
 * Create a new COMMIT draft event.
 */
export async function createCommitEvent(
  tx: any, // Prisma.TransactionClient
  data: {
    workflowId: string;
    companyId: string;
    snapshot: any;
    label?: string;
    userId: string;
  }
) {
  const seq = await getNextDraftSeq(tx, data.workflowId);

  return tx.workflowDraftEvent.create({
    data: {
      workflowId: data.workflowId,
      companyId: data.companyId,
      seq,
      type: DraftEventType.COMMIT,
      label: data.label,
      snapshot: data.snapshot,
      createdBy: data.userId,
    },
  });
}

/**
 * Create a new RESTORE draft event.
 */
export async function createRestoreEvent(
  tx: any, // Prisma.TransactionClient
  data: {
    workflowId: string;
    companyId: string;
    snapshot: any;
    restoresEventId: string;
    userId: string;
  }
) {
  const seq = await getNextDraftSeq(tx, data.workflowId);

  return tx.workflowDraftEvent.create({
    data: {
      workflowId: data.workflowId,
      companyId: data.companyId,
      seq,
      type: DraftEventType.RESTORE,
      label: `Restored from event #${seq - 1}`, // Default label
      snapshot: data.snapshot,
      restoresEventId: data.restoresEventId,
      createdBy: data.userId,
    },
  });
}
