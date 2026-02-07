import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { recordOutcome, startTask } from "@/lib/flowspec/engine";
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

describe("Calendar Commit via Outcome (Phase E2b)", () => {
  const MOCK_USER_ID = "user_commit_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should create new ScheduleBlock and supersede old one on detour resolution", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Setup Workflow and Flow
    const wf = await prisma.workflow.create({
      data: {
        name: "Commit WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [
            { name: "N1", isEntry: true, tasks: { create: { name: "T1", outcomes: { create: { name: "DONE" } } } } },
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
        tasks: n.tasks.map(t => ({ id: t.id, name: t.name, outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }))
      })),
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_commit" }, company.id);
    const flowId = flowResult.flowId!;

    // 2. Create Initial COMMITTED Block
    const initialBlock = await prisma.scheduleBlock.create({
      data: {
        companyId: company.id,
        taskId: t1.id,
        flowId: flowId,
        timeClass: "COMMITTED",
        startAt: new Date("2026-02-10T09:00:00Z"),
        endAt: new Date("2026-02-10T11:00:00Z"),
        createdBy: "system",
      }
    });

    // 3. Start T1
    const { taskExecutionId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    // 4. Create and Accept Change Request (detour linkage)
    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: company.id,
        status: "PENDING",
        flowId: flowId,
        taskId: t1.id,
        requestedBy: MOCK_USER_ID,
        reason: "Commit test",
        metadata: {
          requestedStartAt: "2026-02-10T13:00:00Z",
          requestedEndAt: "2026-02-10T15:00:00Z"
        }
      }
    });

    // Use the review API to accept and link detour
    const reviewReq = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ 
        action: "accept",
        checkpointNodeId: n1.id,
        resumeTargetNodeId: n2.id,
        checkpointTaskExecutionId: taskExecutionId
      })
    });
    const reviewRes = await reviewRoute.POST(reviewReq, { params: Promise.resolve({ id: request.id }) });
    const { detourId } = await reviewRes.json();

    // 5. Resolve Detour via recordOutcome -> should trigger commit
    // Start the task in the detour (wait, detour resolution usually uses a NEW task execution)
    // Actually recordOutcome with detourId resolves it.
    
    // We need a NEW task execution to record the outcome that resolves the detour
    const { taskExecutionId: resolutionTeId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    const outcomeRes = await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, detourId);
    expect(outcomeRes.success).toBe(true);

    // 6. VERIFY COMMITS
    
    // Check old block is superseded
    const oldBlock = await prisma.scheduleBlock.findUnique({ where: { id: initialBlock.id } });
    expect(oldBlock?.supersededAt).not.toBeNull();
    expect(oldBlock?.supersededBy).not.toBeNull();

    // Check new block is created
    const newBlock = await prisma.scheduleBlock.findFirst({
      where: {
        taskId: t1.id,
        timeClass: "COMMITTED",
        supersededAt: null,
      }
    });
    expect(newBlock).not.toBeNull();
    expect(newBlock?.startAt.toISOString()).toBe(new Date("2026-02-10T13:00:00Z").toISOString());
    expect(newBlock?.endAt.toISOString()).toBe(new Date("2026-02-10T15:00:00Z").toISOString());
    expect(newBlock?.changeRequestId).toBe(request.id);
    expect(oldBlock?.supersededBy).toBe(newBlock?.id);

    // Check request is COMMITTED
    const updatedRequest = await prisma.scheduleChangeRequest.findUnique({ where: { id: request.id } });
    expect(updatedRequest?.status).toBe("COMMITTED");
    expect(updatedRequest?.reviewedBy).toBe(MOCK_USER_ID);
  });

  it("should create new ScheduleBlock even if no prior block exists", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Setup WF... (truncated for brevity but same as above)
    const wf = await prisma.workflow.create({
      data: {
        name: "New Block WF", companyId: company.id, status: WorkflowStatus.PUBLISHED,
        nodes: { create: [{ name: "N1", isEntry: true, tasks: { create: { name: "T1", outcomes: { create: { name: "DONE" } } } } }, { name: "N2", tasks: { create: { name: "T2" } } }] }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const n1 = wf.nodes.find(n => n.name === "N1")!;
    const n2 = wf.nodes.find(n => n.name === "N2")!;
    const t1 = n1.tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: wf.nodes.map(n => ({ id: n.id, name: n.name, isEntry: n.isEntry, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: n.tasks.map(t => ({ id: t.id, name: t.name, outcomes: [{ name: "DONE" }], crossFlowDependencies: [] })) })),
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_new" }, company.id);
    const flowId = flowResult.flowId!;
    const { taskExecutionId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    // Request
    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: company.id, status: "PENDING", flowId: flowId, taskId: t1.id, requestedBy: MOCK_USER_ID, reason: "New block test",
        metadata: { requestedStartAt: "2026-02-12T10:00:00Z", requestedEndAt: "2026-02-12T12:00:00Z" }
      }
    });

    // Accept
    const reviewReq = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "accept", checkpointNodeId: n1.id, resumeTargetNodeId: n2.id, checkpointTaskExecutionId: taskExecutionId })
    });
    const reviewRes = await reviewRoute.POST(reviewReq, { params: Promise.resolve({ id: request.id }) });
    const { detourId } = await reviewRes.json();

    // Resolve
    await startTask(flowId, t1.id, MOCK_USER_ID);
    await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, detourId);

    // Verify
    const newBlock = await prisma.scheduleBlock.findFirst({
      where: { taskId: t1.id, timeClass: "COMMITTED", supersededAt: null }
    });
    expect(newBlock).not.toBeNull();
    expect(newBlock?.startAt.toISOString()).toBe(new Date("2026-02-12T10:00:00Z").toISOString());
  });

  it("should fail to commit if metadata is missing startAt/endAt", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: {
        name: "Fail WF", companyId: company.id, status: WorkflowStatus.PUBLISHED,
        nodes: { create: [{ name: "N1", isEntry: true, tasks: { create: { name: "T1", outcomes: { create: { name: "DONE" } } } } }] }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_fail" }, company.id);
    const flowId = flowResult.flowId!;
    const { taskExecutionId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: company.id, status: "PENDING", flowId: flowId, taskId: t1.id, requestedBy: MOCK_USER_ID, reason: "Missing metadata test",
        metadata: { /* missing keys */ }
      }
    });

    const reviewReq = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "accept", checkpointNodeId: wf.nodes[0].id, resumeTargetNodeId: wf.nodes[0].id, checkpointTaskExecutionId: taskExecutionId })
    });
    const reviewRes = await reviewRoute.POST(reviewReq, { params: Promise.resolve({ id: request.id }) });
    const { detourId } = await reviewRes.json();

    await startTask(flowId, t1.id, MOCK_USER_ID);
    const outcomeRes = await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, detourId);
    expect(outcomeRes.success).toBe(true);

    const blocks = await prisma.scheduleBlock.findMany({ where: { taskId: t1.id } });
    expect(blocks.length).toBe(0);
    const updatedReq = await prisma.scheduleChangeRequest.findUnique({ where: { id: request.id } });
    expect(updatedReq?.status).toBe("ACCEPTED"); // Remains ACCEPTED, not COMMITTED
  });

  it("should fail to commit if endAt <= startAt", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: {
        name: "Inverted WF", companyId: company.id, status: WorkflowStatus.PUBLISHED,
        nodes: { create: [{ name: "N1", isEntry: true, tasks: { create: { name: "T1", outcomes: { create: { name: "DONE" } } } } }] }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_inverted" }, company.id);
    const flowId = flowResult.flowId!;
    const { taskExecutionId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: company.id, status: "PENDING", flowId: flowId, taskId: t1.id, requestedBy: MOCK_USER_ID, reason: "Inverted time test",
        metadata: { 
          requestedStartAt: "2026-02-15T12:00:00Z", 
          requestedEndAt: "2026-02-15T10:00:00Z" // End before start
        }
      }
    });

    const reviewReq = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "accept", checkpointNodeId: wf.nodes[0].id, resumeTargetNodeId: wf.nodes[0].id, checkpointTaskExecutionId: taskExecutionId })
    });
    const reviewRes = await reviewRoute.POST(reviewReq, { params: Promise.resolve({ id: request.id }) });
    const { detourId } = await reviewRes.json();

    await startTask(flowId, t1.id, MOCK_USER_ID);
    await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, detourId);

    const blocks = await prisma.scheduleBlock.findMany({ where: { taskId: t1.id } });
    expect(blocks.length).toBe(0);
  });

  it("should fail to commit if detour belongs to a different company than request", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyA.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Workflow in Company A
    const wf = await prisma.workflow.create({
      data: {
        name: "Cross WF", companyId: companyA.id, status: WorkflowStatus.PUBLISHED,
        nodes: { create: [{ name: "N1", isEntry: true, tasks: { create: { name: "T1", outcomes: { create: { name: "DONE" } } } } }] }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_cross" }, companyA.id);
    const flowId = flowResult.flowId!;
    const { taskExecutionId } = await startTask(flowId, t1.id, MOCK_USER_ID);

    // Detour opened in Company A (via Review API)
    const request = await prisma.scheduleChangeRequest.create({
      data: {
        companyId: companyA.id, status: "PENDING", flowId: flowId, taskId: t1.id, requestedBy: MOCK_USER_ID, reason: "Cross tenant check",
        metadata: { requestedStartAt: "2026-02-15T12:00:00Z", requestedEndAt: "2026-02-15T14:00:00Z" }
      }
    });

    const reviewReq = new NextRequest(`http://localhost/api/flowspec/calendar-requests/${request.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "accept", checkpointNodeId: wf.nodes[0].id, resumeTargetNodeId: wf.nodes[0].id, checkpointTaskExecutionId: taskExecutionId })
    });
    const reviewRes = await reviewRoute.POST(reviewReq, { params: Promise.resolve({ id: request.id }) });
    const { detourId } = await reviewRes.json();

    // MALICIOUS CHANGE: Move the request to Company B directly in DB
    await prisma.scheduleChangeRequest.update({
      where: { id: request.id },
      data: { companyId: companyB.id }
    });

    // Now resolve the detour in Company A
    await startTask(flowId, t1.id, MOCK_USER_ID);
    await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, detourId);

    // Verify commit failed
    const blocks = await prisma.scheduleBlock.findMany({ where: { taskId: t1.id } });
    expect(blocks.length).toBe(0);
    const unchangedReq = await prisma.scheduleChangeRequest.findUnique({ where: { id: request.id } });
    expect(unchangedReq?.status).toBe("ACCEPTED");
  });
});
