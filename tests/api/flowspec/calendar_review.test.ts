import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as reviewRoute from "@/app/api/flowspec/calendar-requests/[id]/review/route";
import * as Instantiation from "@/lib/flowspec/instantiation";
import { WorkflowStatus } from "@prisma/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function createTestCompany(name: string = "Test Company") {
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
  await prisma.scheduleBlock.deleteMany({});
  await prisma.scheduleChangeRequest.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.detourRecord.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Calendar Review API (Phase E2a)", () => {
  const MOCK_USER_ID = "user_review_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should only allow tenant reviewer to transition status to IN_REVIEW", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    const memberA = await createTestMember(companyA.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Request for Company B
    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: companyB.id,
        status: "PENDING",
        requestedBy: "other_user",
        reason: "Cross-tenant test"
      }
    });

    const req = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "start_review" })
    });

    const res = await reviewRoute.POST(req, { params: Promise.resolve({ id: request.id }) });
    expect(res.status).toBe(403);

    // Request for Company A
    const requestA = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: companyA.id,
        status: "PENDING",
        requestedBy: "other_user",
        reason: "Valid tenant test"
      }
    });

    const reqA = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${requestA.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "start_review" })
    });

    const resA = await reviewRoute.POST(reqA, { params: Promise.resolve({ id: requestA.id }) });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.changeRequest.status).toBe("IN_REVIEW");
    expect(dataA.changeRequest.reviewedBy).toBe(memberA.id);
  });

  it("should create detour linkage and not change schedule blocks on accept", async () => {
    const company = await createTestCompany();
    const member = await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Setup Workflow and Flow
    const wf = await prisma.workflow.create({
      data: {
        name: "Test WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [
            { name: "N1", isEntry: true, tasks: { create: { name: "T1" } } },
            { name: "N2", tasks: { create: { name: "T2" } } }
          ]
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const n1 = wf.nodes.find(n => n.name === "N1")!;
    const n2 = wf.nodes.find(n => n.name === "N2")!;
    const t1 = n1.tasks[0];

    const snapshot = {
      workflowId: wf.id,
      version: 1,
      name: wf.name,
      nodes: wf.nodes.map(n => ({
        id: n.id,
        name: n.name,
        isEntry: n.isEntry,
        nodeKind: "MAINLINE",
        completionRule: "ALL_TASKS_DONE",
        tasks: n.tasks.map(t => ({ id: t.id, name: t.name, outcomes: [], crossFlowDependencies: [] }))
      })),
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_1" }, company.id);
    const flowId = flowResult.flowId!;

    // Start T1 to get a TaskExecution
    const { startTask } = await import("@/lib/flowspec/engine");
    const { taskExecutionId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    // 2. Create Block (to ensure it remains unchanged)
    const block = await prisma.scheduleBlock.create({
      data: {
        companyId: company.id,
        timeClass: "COMMITTED",
        startAt: new Date("2026-02-10T09:00:00Z"),
        endAt: new Date("2026-02-10T11:00:00Z"),
        createdBy: MOCK_USER_ID,
      }
    });

    // 3. Create Change Request
    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: company.id,
        status: "IN_REVIEW",
        flowId: flowId,
        taskId: t1.id,
        requestedBy: "user_req",
        reason: "Accept test"
      }
    });

    // 4. Accept Request
    const req = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ 
        action: "accept",
        checkpointNodeId: n1.id,
        resumeTargetNodeId: n2.id,
        checkpointTaskExecutionId: taskExecutionId
      })
    });

    const res = await reviewRoute.POST(req, { params: Promise.resolve({ id: request.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    // Verify linkage
    expect(data.changeRequest.status).toBe("ACCEPTED");
    expect(data.changeRequest.detourRecordId).toBe(data.detourId);
    
    const detour = await prisma.detourRecord.findUnique({ where: { id: data.detourId } });
    expect(detour).toBeDefined();
    expect(detour?.flowId).toBe(flowId);

    // Verify block is unchanged
    const unchangedBlock = await prisma.scheduleBlock.findUnique({ where: { id: block.id } });
    expect(unchangedBlock?.startAt.toISOString()).toBe(block.startAt.toISOString());
  });
});
