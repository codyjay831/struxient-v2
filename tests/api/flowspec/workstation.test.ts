/**
 * Work Station Integration API Tests
 *
 * Epic: EPIC-08 Work Station Integration
 * Canon Source: 30_workstation_ui_api_map.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
import * as outcomeRoute from "@/app/api/flowspec/flows/[flowId]/tasks/[taskId]/outcome/route";
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
  await prisma.detourRecord.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.job.deleteMany({});
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

describe("EPIC-08: Work Station Integration", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should query all actionable tasks for the current tenant", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Create a published workflow
    const wf = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: company.id,
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

    const task = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id,
      version: 1,
      name: wf.name,
      nodes: [{
        id: wf.nodes[0].id,
        name: wf.nodes[0].name,
        isEntry: true,
        nodeKind: "MAINLINE",
        completionRule: "ALL_TASKS_DONE",
        tasks: [{
          id: task.id,
          name: task.name,
          outcomes: [{ name: "DONE" }],
          crossFlowDependencies: []
        }]
      }],
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    // 2. Instantiate flow
    await Instantiation.createFlow(wf.id, { type: "job", id: "job_1" }, company.id);

    // 3. Query actionable tasks
    const req = new NextRequest("http://localhost/api/flowspec/actionable-tasks");
    const res = await actionableTasksRoute.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items.length).toBe(1);
    expect(data.items[0].taskId).toBe(task.id);
  });

  it("should submit outcome and advance work", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Create published workflow with routing
    const wf = await prisma.workflow.create({
      data: {
        name: "Flow Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        nodes: {
          create: [
            {
              name: "N1",
              isEntry: true,
              tasks: { create: { name: "T1", outcomes: { create: { name: "GO" } } } }
            },
            {
              name: "N2",
              tasks: { create: { name: "T2", outcomes: { create: { name: "FINISH" } } } }
            }
          ]
        }
      },
      include: { nodes: { include: { tasks: { include: { outcomes: true } } } } }
    });

    const n1 = wf.nodes.find(n => n.name === "N1")!;
    const n2 = wf.nodes.find(n => n.name === "N2")!;
    const t1 = n1.tasks[0];
    const t2 = n2.tasks[0];

    await prisma.gate.create({
      data: { workflowId: wf.id, sourceNodeId: n1.id, outcomeName: "GO", targetNodeId: n2.id }
    });

    const snapshot = {
      workflowId: wf.id,
      version: 1,
      name: wf.name,
      nodes: [
        { id: n1.id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", outcomes: [{ name: "GO" }], crossFlowDependencies: [] }] },
        { id: n2.id, name: "N2", isEntry: false, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t2.id, name: "T2", outcomes: [{ name: "FINISH" }], crossFlowDependencies: [] }] }
      ],
      gates: [{ id: "gate_1", sourceNodeId: n1.id, outcomeName: "GO", targetNodeId: n2.id }]
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    // 2. Instantiate flow
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_2" }, company.id);
    const flowId = flowResult.flowId!;

    // 3. Start task T1 (required for outcome)
    const { startTask } = await import("@/lib/flowspec/engine");
    await startTask(flowId, t1.id, MOCK_USER_ID);

    // 4. Submit outcome GO via API
    const req = new NextRequest(`http://localhost/api/flowspec/flows/${flowId}/tasks/${t1.id}/outcome`, {
      method: "POST",
      body: JSON.stringify({ outcome: "GO" })
    });
    const res = await outcomeRoute.POST(req, { params: Promise.resolve({ flowId, taskId: t1.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.gateResults[0].activated).toBe(true);
    expect(data.gateResults[0].targetNodeId).toBe(n2.id);

    // 5. Verify T2 is now actionable
    const actionableRes = await actionableTasksRoute.GET(new NextRequest("http://localhost/api/flowspec/actionable-tasks"));
    const actionableData = await actionableRes.json();
    expect(actionableData.items.some((t: any) => t.taskId === t2.id)).toBe(true);
  });
});
