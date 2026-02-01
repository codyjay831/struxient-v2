import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
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
  // Ordered delete to respect foreign keys
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

describe("Phase 2 API Integration Tests", () => {
  const MOCK_USER_ID = "user_123";
  let testCompany: any;
  let testJob: any;
  let testMember: any;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();

    testCompany = await prisma.company.create({ data: { name: "Phase 2 Test Co" } });
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

    const customer = await prisma.customer.create({
      data: { companyId: testCompany.id, name: "Customer P2" }
    });

    const flowResult = await Instantiation.createFlow(workflow.id, { type: "job", id: "job_p2" }, testCompany.id);
    const flowGroupId = flowResult.flowGroupId!;

    testJob = await prisma.job.create({
      data: { companyId: testCompany.id, customerId: customer.id, flowGroupId: flowGroupId, address: "P2 Address" }
    });

    // Verification step
    const checkFg = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
      include: { job: true }
    });
    if (!checkFg?.job) {
      throw new Error(`CRITICAL: FlowGroup ${flowGroupId} not linked to job!`);
    }
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("T-AssignmentsDoNotReduce: Actionable set unchanged after assignments added", async () => {
    // 1. Get actionable tasks before assignment
    const res1 = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data1 = await res1.json();
    const initialCount = data1.items.length;
    expect(initialCount).toBeGreaterThan(0);

    // 2. Create an assignment
    const assignRes = await assignmentsRoute.POST(
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
    expect(assignRes.status).toBe(200);

    const checkAssign = await prisma.jobAssignment.findMany({
      where: { jobId: testJob.id, supersededAt: null }
    });
    if (checkAssign.length === 0) {
      throw new Error("CRITICAL: Assignment was not created despite 200 OK!");
    }

    // 3. Get actionable tasks after assignment
    const res2 = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data2 = await res2.json();
    
    expect(data2.items.length).toBe(initialCount);
    expect(data2.items[0]._metadata.assignments.length).toBe(1);
    expect(data2.items[0]._metadata.assignments[0].slotKey).toBe("PM");
  });

  it("T-AssignmentsEndpointTenantIsolation: Cross-tenant access is blocked", async () => {
    const otherCompany = await prisma.company.create({ data: { name: "Other Co" } });
    const otherMember = await prisma.companyMember.create({
      data: { companyId: otherCompany.id, userId: "other_user", role: "OWNER" }
    });

    // Mock other user
    (auth as any).mockResolvedValue({ userId: "other_user" });

    // Try to read assignments for testJob (different company)
    const getRes = await assignmentsRoute.GET(
      new NextRequest(`http://localhost/api/jobs/${testJob.id}/assignments`),
      { params: Promise.resolve({ id: testJob.id }) }
    );
    expect(getRes.status).toBe(403); // NO_MEMBERSHIP or similar via verifyTenantOwnership

    // Try to write assignment for testJob
    const postRes = await assignmentsRoute.POST(
      new NextRequest(`http://localhost/api/jobs/${testJob.id}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          slotKey: "PM",
          assigneeType: AssigneeType.PERSON,
          memberId: otherMember.id
        })
      }),
      { params: Promise.resolve({ id: testJob.id }) }
    );
    expect(postRes.status).toBe(403);
  });
});
