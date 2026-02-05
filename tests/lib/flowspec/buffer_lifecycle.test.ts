import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { 
  addTaskToBuffer, 
  deleteDraftBuffer, 
  getDraftBuffer 
} from "@/lib/flowspec/persistence/draft-buffer";
import { WorkflowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.workflowDraftBuffer.deleteMany({});
  await prisma.workflowDraftEvent.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Buffer Lifecycle: Discard and Re-seed", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should successfully add a task after buffer was discarded (automatic re-seeding)", async () => {
    const company = await createTestCompany();
    
    // 1. Create a workflow with a node
    const workflow = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    const node = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: "Node 1",
      },
    });

    // 2. Ensure no buffer exists initially
    let buffer = await getDraftBuffer(workflow.id, company.id);
    expect(buffer).toBeNull();

    // 3. Add a task - this should trigger ensureDraftBuffer (seeding)
    await addTaskToBuffer(
      workflow.id, 
      company.id, 
      node.id, 
      { name: "Task 1", instructions: "Test" }, 
      MOCK_USER_ID
    );

    buffer = await getDraftBuffer(workflow.id, company.id);
    expect(buffer).not.toBeNull();
    expect((buffer?.content as any).nodes[0].tasks.length).toBe(1);

    // 4. DISCARD the buffer
    await deleteDraftBuffer(workflow.id, company.id);
    buffer = await getDraftBuffer(workflow.id, company.id);
    expect(buffer).toBeNull();

    // 5. Add another task - this is where the bug was!
    // It must automatically re-seed the buffer.
    await addTaskToBuffer(
      workflow.id, 
      company.id, 
      node.id, 
      { name: "Task 2", instructions: "Test after discard" }, 
      MOCK_USER_ID
    );

    // 6. Verify success
    buffer = await getDraftBuffer(workflow.id, company.id);
    expect(buffer).not.toBeNull();
    
    const content = buffer?.content as any;
    const nodeInContent = content.nodes.find((n: any) => n.id === node.id);
    expect(nodeInContent.tasks.length).toBe(1); // Relational Truth had 0 tasks, so re-seeded buffer + 1 new task = 1 task
    expect(nodeInContent.tasks[0].name).toBe("Task 2");
  });
});
