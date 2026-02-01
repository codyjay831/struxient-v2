import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
import * as meRoute from "@/app/api/tenancy/me/route";
import * as assignmentsRoute from "@/app/api/jobs/[id]/assignments/route";
import * as Instantiation from "@/lib/flowspec/instantiation";
import { WorkflowStatus } from "@prisma/client";
import { AssigneeType } from "@/lib/responsibility/constants";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function cleanupTestData() {
  await prisma.jobAssignment.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.fanOutFailure.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Phase 5: Work Station UI Integration Logic", () => {
  const MOCK_USER_ID = "user_123";
  let testCompany: any;
  let testJob: any;
  let testMember: any;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();

    testCompany = await prisma.company.create({ data: { name: "Phase 5 Test Co" } });
    testMember = await prisma.companyMember.create({
      data: { companyId: testCompany.id, userId: MOCK_USER_ID, role: "OWNER" }
    });
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const workflow = await prisma.workflow.create({
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
              create: { name: "Task 1", outcomes: { create: { name: "DONE" } } }
            }
          }
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const snapshot = {
      workflowId: workflow.id,
      version: 1,
      name: workflow.name,
      nodes: [{
        id: workflow.nodes[0].id,
        name: workflow.nodes[0].name,
        isEntry: true,
        completionRule: "ALL_TASKS_DONE",
        tasks: [{ id: workflow.nodes[0].tasks[0].id, name: "Task 1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }]
      }],
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(workflow.id, { type: "job", id: "job_p5" }, testCompany.id);
    const flowGroupId = flowResult.flowGroupId!;

    const customer = await prisma.customer.create({
      data: { companyId: testCompany.id, name: "Customer P5" }
    });

    testJob = await prisma.job.create({
      data: { companyId: testCompany.id, customerId: customer.id, flowGroupId: flowGroupId, address: "P5 Address" }
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("T-MeEndpoint: Returns current memberId correctly", async () => {
    const res = await meRoute.GET(new NextRequest("http://localhost/api/tenancy/me"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.memberId).toBe(testMember.id);
  });

  it("T-UIMatchingLogic: Correctly identifies tasks assigned to me", async () => {
    // 1. Initially no assignments
    const res1 = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data1 = await res1.json();
    const task = data1.items[0];
    
    const isAssignedToMe = (t: any, myId: string) => {
      const assignments = t._metadata?.assignments || [];
      return assignments.some((a: any) => a.assigneeType === 'PERSON' && a.assignee.id === myId);
    };

    expect(isAssignedToMe(task, testMember.id)).toBe(false);

    // 2. Create assignment for ME
    await assignmentsRoute.POST(
      new NextRequest(`http://localhost/api/jobs/${testJob.id}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          slotKey: "PM",
          assigneeType: AssigneeType.PERSON,
          memberId: testMember.id
        })
      }),
      { params: Promise.resolve({ id: testJob.id }) }
    );

    // 3. Verify task now matches
    const res2 = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data2 = await res2.json();
    const taskAfter = data2.items[0];
    expect(isAssignedToMe(taskAfter, testMember.id)).toBe(true);
  });

  it("T-UIMatchingLogic: Does NOT match EXTERNAL assignments", async () => {
    // 1. Create external party
    const external = await prisma.externalParty.create({
      data: { companyId: testCompany.id, name: "Ext Party" }
    });

    // 2. Create assignment for EXTERNAL
    await assignmentsRoute.POST(
      new NextRequest(`http://localhost/api/jobs/${testJob.id}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          slotKey: "SUB",
          assigneeType: AssigneeType.EXTERNAL,
          externalPartyId: external.id
        })
      }),
      { params: Promise.resolve({ id: testJob.id }) }
    );

    // 3. Verify task does NOT match my ID
    const res = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data = await res.json();
    const task = data.items[0];
    
    const isAssignedToMe = (t: any, myId: string) => {
      const assignments = t._metadata?.assignments || [];
      return assignments.some((a: any) => a.assigneeType === 'PERSON' && a.assignee.id === myId);
    };

    expect(isAssignedToMe(task, testMember.id)).toBe(false);
    expect(task._metadata.assignments.length).toBe(1);
    expect(task._metadata.assignments[0].assigneeType).toBe('EXTERNAL');
  });
});
