import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as crossFlowRoute from "@/app/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]/cross-flow-dependencies/route";
import { WorkflowStatus } from "@prisma/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function createTestCompany(name: string = "API Co") {
  return prisma.company.create({
    data: { name },
  });
}

async function createTestMember(companyId: string, userId: string) {
  return prisma.companyMember.create({
    data: {
      companyId,
      userId,
      role: "OWNER",
    },
  });
}

async function cleanupTestData() {
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.crossFlowDependency.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Cross-Flow Dependency API Compliance", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should reject POST with invalid sourceTaskPath format", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: { name: "W1", companyId: company.id }
    });
    const node = await prisma.node.create({ data: { workflowId: wf.id, name: "N1" } });
    const task = await prisma.task.create({ data: { nodeId: node.id, name: "T1" } });

    const req = new NextRequest(`http://localhost/api/flowspec/workflows/${wf.id}/nodes/${node.id}/tasks/${task.id}/cross-flow-dependencies`, {
      method: "POST",
      body: JSON.stringify({
        sourceWorkflowId: "some-id",
        sourceTaskPath: "invalid-format", // No dot
        requiredOutcome: "DONE"
      }),
    });

    const res = await crossFlowRoute.POST(req, { 
      params: Promise.resolve({ id: wf.id, nodeId: node.id, taskId: task.id }) 
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_TASK_PATH_FORMAT");
  });

  it("should accept POST with valid nodeId.taskId format", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: { name: "W1", companyId: company.id }
    });
    const node = await prisma.node.create({ data: { workflowId: wf.id, name: "N1" } });
    const task = await prisma.task.create({ data: { nodeId: node.id, name: "T1" } });

    const sourceWf = await prisma.workflow.create({
      data: { name: "Source", companyId: company.id }
    });

    const req = new NextRequest(`http://localhost/api/flowspec/workflows/${wf.id}/nodes/${node.id}/tasks/${task.id}/cross-flow-dependencies`, {
      method: "POST",
      body: JSON.stringify({
        sourceWorkflowId: sourceWf.id,
        sourceTaskPath: "node_id.task_id",
        requiredOutcome: "DONE"
      }),
    });

    const res = await crossFlowRoute.POST(req, { 
      params: Promise.resolve({ id: wf.id, nodeId: node.id, taskId: task.id }) 
    });
    
    expect(res.status).toBe(201);
  });
});
