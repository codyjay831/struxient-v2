import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
import * as outcomeRoute from "@/app/api/flowspec/flows/[flowId]/tasks/[taskId]/outcome/route";
import * as startRoute from "@/app/api/flowspec/flows/[flowId]/tasks/[taskId]/start/route";
import * as Instantiation from "@/lib/flowspec/instantiation";
import { WorkflowStatus } from "@prisma/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function cleanupTestData() {
  await prisma.detourRecord.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Phase 3 Integration Tests", () => {
  const MOCK_USER_ID = "user_123";
  let testCompany: any;
  let testWorkflow: any;
  let testFlowId: string;
  let testTaskId: string;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();

    testCompany = await prisma.company.create({ data: { name: "Phase 3 Test Co" } });
    await prisma.companyMember.create({
      data: { companyId: testCompany.id, userId: MOCK_USER_ID, role: "OWNER" }
    });
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    testWorkflow = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: testCompany.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        nodes: {
          create: {
            name: "Node 1",
            isEntry: true,
            tasks: {
              create: {
                name: "Task 1",
                outcomes: { create: { name: "DONE" } }
              }
            }
          }
        }
      },
      include: { nodes: { include: { tasks: { include: { outcomes: true } } } } }
    });

    testTaskId = testWorkflow.nodes[0].tasks[0].id;
    const snapshot = {
      workflowId: testWorkflow.id,
      version: 1,
      name: testWorkflow.name,
      nodes: [{
        id: testWorkflow.nodes[0].id,
        name: testWorkflow.nodes[0].name,
        isEntry: true,
        completionRule: "ALL_TASKS_DONE",
        tasks: [{
          id: testTaskId,
          name: "Task 1",
          outcomes: [{ name: "DONE" }],
          crossFlowDependencies: []
        }]
      }],
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: testWorkflow.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(testWorkflow.id, { type: "job", id: "job_p3" }, testCompany.id);
    testFlowId = flowResult.flowId!;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("T-ExecutionAuthority: Non-assigned user can start task and record outcome", async () => {
    // In current system, "assigned" doesn't exist yet, so any member is "non-assigned" in the future sense
    // This test ensures that the standard API calls work for a valid company member.
    
    // 1. Start Task
    const startReq = new NextRequest(`http://localhost/api/flowspec/flows/${testFlowId}/tasks/${testTaskId}/start`, {
      method: "POST"
    });
    const startRes = await startRoute.POST(startReq, { params: Promise.resolve({ flowId: testFlowId, taskId: testTaskId }) });
    expect(startRes.status).toBe(200);

    // 2. Record Outcome
    const outcomeReq = new NextRequest(`http://localhost/api/flowspec/flows/${testFlowId}/tasks/${testTaskId}/outcome`, {
      method: "POST",
      body: JSON.stringify({ outcome: "DONE" })
    });
    const outcomeRes = await outcomeRoute.POST(outcomeReq, { params: Promise.resolve({ flowId: testFlowId, taskId: testTaskId }) });
    expect(outcomeRes.status).toBe(200);
    const outcomeData = await outcomeRes.json();
    expect(outcomeData.success).toBe(true);
  });

  it("T-ViewHintPayload: viewHint=myAssignments returns identical tasks.length", async () => {
    const reqUnfiltered = new NextRequest("http://localhost/api/flowspec/actionable-tasks");
    const resUnfiltered = await actionableTasksRoute.GET(reqUnfiltered);
    const dataUnfiltered = await resUnfiltered.json();

    const reqFiltered = new NextRequest("http://localhost/api/flowspec/actionable-tasks?viewHint=myAssignments");
    const resFiltered = await actionableTasksRoute.GET(reqFiltered);
    const dataFiltered = await resFiltered.json();

    expect(dataUnfiltered.items.length).toBe(1);
    expect(dataFiltered.items.length).toBe(dataUnfiltered.items.length);
  });

  it("T-IdenticalSet: Metadata stripping and byte-identity comparison", async () => {
    // We'll simulate two users by calling the route twice (mocking auth is already done)
    // and verifying the canonical set is identical.
    
    const req1 = new NextRequest("http://localhost/api/flowspec/actionable-tasks");
    const res1 = await actionableTasksRoute.GET(req1);
    const data1 = await res1.json();

    const req2 = new NextRequest("http://localhost/api/flowspec/actionable-tasks");
    const res2 = await actionableTasksRoute.GET(req2);
    const data2 = await res2.json();

    const stripMetadata = (task: any) => {
      const stripped = { ...task };
      delete stripped._metadata;
      delete stripped.assignment;
      delete stripped.assignedTo;
      delete stripped.responsibility;
      Object.keys(stripped).forEach(key => {
        if (key.startsWith("assignment_") || key.startsWith("responsibility_")) {
          delete stripped[key];
        }
      });
      return stripped;
    };

    const canonical1 = data1.items.map(stripMetadata).sort((a: any, b: any) => {
      if (a.flowId !== b.flowId) return a.flowId.localeCompare(b.flowId);
      if (a.taskId !== b.taskId) return a.taskId.localeCompare(b.taskId);
      return (a.iteration || 0) - (b.iteration || 0);
    });

    const canonical2 = data2.items.map(stripMetadata).sort((a: any, b: any) => {
      if (a.flowId !== b.flowId) return a.flowId.localeCompare(b.flowId);
      if (a.taskId !== b.taskId) return a.taskId.localeCompare(b.taskId);
      return (a.iteration || 0) - (b.iteration || 0);
    });

    expect(JSON.stringify(canonical1)).toBe(JSON.stringify(canonical2));
  });
});
