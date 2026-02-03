/**
 * Policy Integration API Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as policyRoute from "@/app/api/flowspec/flow-groups/[id]/policy/route";
import * as snapshotTasksRoute from "@/app/api/flowspec/flow-groups/[id]/snapshot-tasks/route";
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
  await prisma.taskPolicyOverride.deleteMany({});
  await prisma.flowGroupPolicy.deleteMany({});
  await prisma.jobAssignment.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.fanOutFailure.deleteMany({});
  await prisma.fanOutRule.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.gate.deleteMany({});
  await prisma.crossFlowDependency.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Policy API Integration", () => {
  const MOCK_USER_ID = "user_policy_test";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("PUT /policy should reject unknown taskId with 400", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Create a flow group and flow with a snapshot
    const fg = await prisma.flowGroup.create({
      data: {
        scopeType: "test",
        scopeId: "scope_1",
        companyId: company.id
      }
    });

    const wf = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        nodes: {
          create: {
            name: "Node 1",
            tasks: {
              create: { name: "Valid Task" }
            }
          }
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const task = wf.nodes[0].tasks[0];
    const snapshot = {
      nodes: [{
        id: wf.nodes[0].id,
        tasks: [{ id: task.id, name: task.name }]
      }]
    };

    const wv = await prisma.workflowVersion.create({
      data: {
        workflowId: wf.id,
        version: 1,
        snapshot: snapshot as any,
        publishedBy: MOCK_USER_ID
      }
    });

    await prisma.flow.create({
      data: {
        workflowId: wf.id,
        workflowVersionId: wv.id,
        flowGroupId: fg.id,
        status: "ACTIVE"
      }
    });

    // 2. Attempt to set override for an unknown taskId
    const req = new NextRequest(`http://localhost/api/flowspec/flow-groups/${fg.id}/policy`, {
      method: "PUT",
      body: JSON.stringify({
        jobPriority: "HIGH",
        taskOverrides: [
          { taskId: task.id, slaHours: 24 }, // Valid
          { taskId: "unknown-task-id", slaHours: 12 } // Invalid
        ]
      })
    });

    const res = await policyRoute.PUT(req, { params: Promise.resolve({ id: fg.id }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_TASK_OVERRIDES");
    expect(data.error.message).toContain("Task override validation failed");
    expect(data.error.details.errors[0]).toContain('Task ID "unknown-task-id" does not exist');
  });

  it("GET /snapshot-tasks should return tasks from bound snapshots", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const fg = await prisma.flowGroup.create({
      data: {
        scopeType: "test",
        scopeId: "scope_2",
        companyId: company.id
      }
    });

    const snapshot = {
      nodes: [{
        id: "n1",
        tasks: [
          { id: "t1", name: "Task 1", defaultSlaHours: 24 },
          { id: "t2", name: "Task 2", defaultSlaHours: null }
        ]
      }]
    };

    const wf = await prisma.workflow.create({
      data: { name: "W1", companyId: company.id }
    });

    const wv = await prisma.workflowVersion.create({
      data: {
        workflowId: wf.id,
        version: 1,
        snapshot: snapshot as any,
        publishedBy: MOCK_USER_ID
      }
    });

    await prisma.flow.create({
      data: {
        workflowId: wf.id,
        workflowVersionId: wv.id,
        flowGroupId: fg.id,
        status: "ACTIVE"
      }
    });

    const req = new NextRequest(`http://localhost/api/flowspec/flow-groups/${fg.id}/snapshot-tasks`);
    const res = await snapshotTasksRoute.GET(req, { params: Promise.resolve({ id: fg.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks.find((t: any) => t.taskId === "t1").taskName).toBe("Task 1");
    expect(data.tasks.find((t: any) => t.taskId === "t1").defaultSlaHours).toBe(24);
  });
});
