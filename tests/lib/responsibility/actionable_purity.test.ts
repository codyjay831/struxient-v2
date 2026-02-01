import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
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

describe("Actionable Projection Purity (GAP-P3-10)", () => {
  const MOCK_USER_ID = "user_123";
  let testCompany: any;
  let testJob: any;
  let testMember: any;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();

    testCompany = await prisma.company.create({ data: { name: "Purity Test Co" } });
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
      data: { companyId: testCompany.id, name: "Customer Purity" }
    });

    const flowResult = await Instantiation.createFlow(workflow.id, { type: "job", id: "job_purity" }, testCompany.id);
    const flowGroupId = flowResult.flowGroupId!;

    testJob = await prisma.job.create({
      data: { companyId: testCompany.id, customerId: customer.id, flowGroupId: flowGroupId, address: "Purity Address" }
    });

    // Create an assignment
    await prisma.jobAssignment.create({
      data: {
        jobId: testJob.id,
        slotKey: "PM",
        assigneeType: AssigneeType.PERSON as any,
        memberId: testMember.id,
        assignedByMemberId: testMember.id
      }
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("T-Actionable-Purity: Response does not contain forbidden keys in metadata", async () => {
    const res = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data = await res.json();
    
    expect(data.items.length).toBeGreaterThan(0);
    const task = data.items[0];
    const assignments = task._metadata.assignments;
    expect(assignments.length).toBe(1);
    
    // Deep-walk and assert no forbidden keys
    const forbiddenKeys = ['userId', 'role', 'capability', 'capabilities', 'permission', 'permissions'];
    
    function checkKeys(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key in obj) {
        expect(forbiddenKeys).not.toContain(key.toLowerCase());
        checkKeys(obj[key]);
      }
    }
    
    // Specifically check under assignments
    checkKeys(assignments);
    
    // Verify minimal shape for PERSON
    const personAssignee = assignments.find((a: any) => a.assigneeType === AssigneeType.PERSON).assignee;
    expect(Object.keys(personAssignee)).toEqual(['id']);
    
    // Add an EXTERNAL assignment and verify its minimal shape
    const externalParty = await prisma.externalParty.create({
      data: { companyId: testCompany.id, name: "Ext Party Purity" }
    });
    await prisma.jobAssignment.create({
      data: {
        jobId: testJob.id,
        slotKey: "EXT_SLOT",
        assigneeType: AssigneeType.EXTERNAL as any,
        externalPartyId: externalParty.id,
        assignedByMemberId: testMember.id
      }
    });

    const res2 = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const data2 = await res2.json();
    const task2 = data2.items[0];
    const assignments2 = task2._metadata.assignments;
    const externalAssignee = assignments2.find((a: any) => a.assigneeType === AssigneeType.EXTERNAL).assignee;
    
    expect(Object.keys(externalAssignee).sort()).toEqual(['id', 'name'].sort());
    checkKeys(assignments2);
  });
});
