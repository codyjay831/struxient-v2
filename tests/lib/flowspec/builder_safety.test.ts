/**
 * Builder Save Safety Tests
 * 
 * Canon: Builder Save Safety v1
 * 
 * Verifies the integrity of the draft buffer system, commit/restore logic,
 * and tenant isolation for the workflow builder.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { WorkflowStatus, DraftEventType } from "@prisma/client";
import { ensureDraftBuffer, getDraftBuffer, deleteDraftBuffer, updateNodeInBuffer } from "@/lib/flowspec/persistence/draft-buffer";
import { createCommitEvent, createRestoreEvent, getDraftHistory, getNextDraftSeq } from "@/lib/flowspec/persistence/draft-events";
import { commitDraftToWorkflow } from "@/lib/flowspec/persistence/workflow";
import { createWorkflowSnapshot } from "@/lib/flowspec/lifecycle/versioning";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.workflowDraftBuffer.deleteMany({});
  await prisma.workflowDraftEvent.deleteMany({});
  await prisma.gate.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Builder Save Safety (Phase 3 Infrastructure)", () => {
  let company: any;
  let company2: any;
  let workflow: any;

  beforeEach(async () => {
    await cleanupTestData();
    company = await createTestCompany("Company 1");
    company2 = await createTestCompany("Company 2");

    workflow = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    // Add a node to the workflow
    await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: "Initial Node",
        position: { x: 100, y: 100 },
      },
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  // 1. Tenant isolation: buffer and events never cross company
  it("enforces tenant isolation for draft buffers and events", async () => {
    // Try to seed buffer for workflow in company 1 using company 2's ID
    await expect(ensureDraftBuffer(workflow.id, company2.id, "user-1")).rejects.toThrow("Tenant mismatch");

    // Create event for company 1
    const event = await prisma.workflowDraftEvent.create({
      data: {
        companyId: company.id,
        workflowId: workflow.id,
        seq: 1,
        type: DraftEventType.INITIAL,
        snapshot: {},
        createdBy: "user-1",
      },
    });

    // Verify history only shows events for the correct company
    const history = await getDraftHistory(workflow.id, company.id);
    expect(history.length).toBe(1);
    
    const history2 = await getDraftHistory(workflow.id, company2.id);
    expect(history2.length).toBe(0);
  });

  // 2. Buffer-first read logic (Persistence layer check)
  it("seeds buffer correctly and returns WIP state", async () => {
    // Seed buffer
    const buffer = await ensureDraftBuffer(workflow.id, company.id, "user-1");
    expect(buffer.content).toBeDefined();
    expect(buffer.baseEventId).toBeDefined();

    // Verify it was seeded from relational state
    const content = buffer.content as any;
    expect(content.nodes.length).toBe(1);
    expect(content.nodes[0].name).toBe("Initial Node");
  });

  // 3. Semantic patch doesn't touch truth tables
  it("stages semantic changes in buffer without touching relational tables", async () => {
    await ensureDraftBuffer(workflow.id, company.id, "user-1");
    
    // Get the node
    const node = await prisma.node.findFirst({ where: { workflowId: workflow.id } });
    
    // Perform semantic update via buffer
    await updateNodeInBuffer(workflow.id, company.id, node!.id, { name: "Updated Name" }, "user-1");
    
    // Verify buffer is updated
    const buffer = await getDraftBuffer(workflow.id, company.id);
    expect((buffer!.content as any).nodes[0].name).toBe("Updated Name");
    
    // Verify relational table remains UNCHANGED (Staged Principle)
    const relationalNode = await prisma.node.findUnique({ where: { id: node!.id } });
    expect(relationalNode!.name).toBe("Initial Node");
  });

  // 4. Commit atomicity: forced failure rolls back everything
  it("rolls back commit transaction on failure", async () => {
    await ensureDraftBuffer(workflow.id, company.id, "user-1");
    const buffer = await getDraftBuffer(workflow.id, company.id);
    const snapshot = buffer!.content as any;
    
    // Modify snapshot to have an invalid state (e.g. duplicate node name)
    // but here we'll just mock a failure during hydration
    
    try {
      await prisma.$transaction(async (tx) => {
        // This should pass
        await createCommitEvent(tx, {
          workflowId: workflow.id,
          companyId: company.id,
          snapshot: snapshot,
          userId: "user-1",
        });
        
        // Force an error
        throw new Error("Simulated Failure");
      });
    } catch (e) {
      // Expected
    }
    
    // Verify no event was created (rollback)
    const history = await getDraftHistory(workflow.id, company.id);
    expect(history.length).toBe(1); // Only the INITIAL event from ensureDraftBuffer
  });

  // 5. Seq concurrency: parallel commits don't collide
  it("allocates sequences correctly under parallel commits", async () => {
    // Seed buffer
    await ensureDraftBuffer(workflow.id, company.id, "user-1");
    
    // Simulate parallel commits
    const commitPromises = Array.from({ length: 5 }).map((_, i) => {
      return prisma.$transaction(async (tx) => {
        return createCommitEvent(tx, {
          workflowId: workflow.id,
          companyId: company.id,
          snapshot: { i },
          label: `Commit ${i}`,
          userId: "user-1",
        });
      });
    });

    const results = await Promise.all(commitPromises);
    const seqs = results.map(r => r.seq).sort((a, b) => a - b);
    
    // Seqs should be 2, 3, 4, 5, 6 (1 was INITIAL)
    expect(seqs).toEqual([2, 3, 4, 5, 6]);
  });

  // 6. Restore doesn't mutate truth
  it("restore stages changes in buffer without touching truth tables", async () => {
    // 1. Initial state
    await ensureDraftBuffer(workflow.id, company.id, "user-1");
    const node = await prisma.node.findFirst({ where: { workflowId: workflow.id } });
    
    // 2. Commit a change
    const buffer = await getDraftBuffer(workflow.id, company.id);
    const updatedContent = { ...buffer!.content as any };
    updatedContent.nodes[0].name = "Version 2";
    
    await prisma.$transaction(async (tx) => {
      await createCommitEvent(tx, {
        workflowId: workflow.id,
        companyId: company.id,
        snapshot: updatedContent,
        userId: "user-1",
      });
      await commitDraftToWorkflow(workflow.id, company.id, updatedContent, "user-1", tx);
    }, { timeout: 15000 });

    // Verify truth is updated
    const nodeV2 = await prisma.node.findUnique({ where: { id: node!.id } });
    expect(nodeV2!.name).toBe("Version 2");

    // 3. Restore to INITIAL event (seq 1)
    const history = await getDraftHistory(workflow.id, company.id);
    const initialEvent = history.find(h => h.seq === 1);
    
    // Mock the restore endpoint logic
    await prisma.$transaction(async (tx) => {
      const event = await tx.workflowDraftEvent.findUnique({ where: { id: initialEvent!.id } });
      if (!event) throw new Error("Event not found");
      
      await createRestoreEvent(tx, {
        workflowId: workflow.id,
        companyId: company.id,
        snapshot: event.snapshot,
        restoresEventId: initialEvent!.id,
        userId: "user-1",
      });
      
      // Update buffer
      const { layout, ...semanticPart } = event.snapshot as any;
      await tx.workflowDraftBuffer.update({
        where: { companyId_workflowId: { companyId: company.id, workflowId: workflow.id } },
        data: { content: semanticPart }
      });
    }, { timeout: 15000 });

    // Verify truth remains UNCHANGED (Staged Principle)
    const nodeStillV2 = await prisma.node.findUnique({ where: { id: node!.id } });
    expect(nodeStillV2!.name).toBe("Version 2");
    
    // Verify buffer is restored
    const restoredBuffer = await getDraftBuffer(workflow.id, company.id);
    expect((restoredBuffer!.content as any).nodes[0].name).toBe("Initial Node");
  });

  // 7. Discard wipes buffer but not positions
  it("discard wipes buffer semantic state but leaves positions intact", async () => {
    await ensureDraftBuffer(workflow.id, company.id, "user-1");
    const node = await prisma.node.findFirst({ where: { workflowId: workflow.id } });

    // Update position (relational/truth)
    await prisma.node.update({
      where: { id: node!.id },
      data: { position: { x: 500, y: 500 } }
    });

    // Update semantic (buffer)
    await updateNodeInBuffer(workflow.id, company.id, node!.id, { name: "Draft Name" }, "user-1");

    // Discard
    await deleteDraftBuffer(workflow.id, company.id);

    // Verify buffer is gone
    const buffer = await getDraftBuffer(workflow.id, company.id);
    expect(buffer).toBeNull();

    // Verify position remains at 500 (Autosave Principle)
    const nodeAfterDiscard = await prisma.node.findUnique({ where: { id: node!.id } });
    expect((nodeAfterDiscard!.position as any).x).toBe(500);
  });

  // 8. Revert layout logic check
  it("revert layout pulls positions from last commit", async () => {
    // Initial state (seq 1)
    await ensureDraftBuffer(workflow.id, company.id, "user-1");
    const node = await prisma.node.findFirst({ where: { workflowId: workflow.id } });
    // Initial position is 100, 100

    // Update position to 999 (autosave)
    await prisma.node.update({
      where: { id: node!.id },
      data: { position: { x: 999, y: 999 } }
    });

    // Fetch last commit event (seq 1 is INITIAL)
    const history = await getDraftHistory(workflow.id, company.id);
    const lastEvent = history[0]; // seq 1
    const event = await prisma.workflowDraftEvent.findUnique({ where: { id: lastEvent.id } });
    
    // Mock "Revert Layout" logic
    const snapshot = event!.snapshot as any;
    const layout = snapshot.layout as Array<{ id: string, position: any }>;
    
    for (const entry of layout) {
      await prisma.node.update({
        where: { id: entry.id },
        data: { position: entry.position }
      });
    }

    // Verify position is back to 100
    const nodeAfterRevert = await prisma.node.findUnique({ where: { id: node!.id } });
    expect((nodeAfterRevert!.position as any).x).toBe(100);
  });
}, 30000); // 30s timeout for database operations

