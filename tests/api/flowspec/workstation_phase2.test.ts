/**
 * Work Station Phase 2 Integration Tests
 * 
 * Focus: Evidence UI and Job Drill-down
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
import * as flowGroupTasksRoute from "@/app/api/flowspec/flow-groups/[id]/actionable-tasks/route";
import * as evidenceRoute from "@/app/api/flowspec/flows/[flowId]/tasks/[taskId]/evidence/route";
import * as outcomeRoute from "@/app/api/flowspec/flows/[flowId]/tasks/[taskId]/outcome/route";
import * as startRoute from "@/app/api/flowspec/flows/[flowId]/tasks/[taskId]/start/route";
import * as Instantiation from "@/lib/flowspec/instantiation";
import { WorkflowStatus, EvidenceType } from "@prisma/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function createTestCompany(name: string = "Phase 2 Company") {
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
  await prisma.workflowVersion.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Work Station Phase 2 API Tests", () => {
  const MOCK_USER_ID = "user_phase2";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  async function setupWorkflowWithEvidence(companyId: string, evidenceRequired: boolean = true) {
    const wf = await prisma.workflow.create({
      data: {
        name: "Evidence Workflow",
        companyId: companyId,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        nodes: {
          create: {
            name: "N1",
            isEntry: true,
            tasks: {
              create: {
                name: "T1",
                evidenceRequired,
                evidenceSchema: { type: "text", description: "Test schema" },
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
        completionRule: "ALL_TASKS_DONE",
        tasks: [{
          id: task.id,
          name: task.name,
          evidenceRequired,
          evidenceSchema: { type: "text", description: "Test schema" },
          outcomes: [{ name: "DONE" }],
          crossFlowDependencies: []
        }]
      }],
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    return { wf, task };
  }

  it("should block outcome if evidence is required but missing", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    const { wf, task } = await setupWorkflowWithEvidence(company.id, true);
    
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_ev_1" }, company.id);
    const flowId = flowResult.flowId!;

    // 1. Start task
    await startRoute.POST(new NextRequest("http://localhost/api", { method: "POST" }), { params: Promise.resolve({ flowId, taskId: task.id }) });

    // 2. Attempt outcome without evidence
    const req = new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ outcome: "DONE" })
    });
    const res = await outcomeRoute.POST(req, { params: Promise.resolve({ flowId, taskId: task.id }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("EVIDENCE_REQUIRED");
  });

  it("should allow evidence attachment and then outcome submission", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    const { wf, task } = await setupWorkflowWithEvidence(company.id, true);
    
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_ev_2" }, company.id);
    const flowId = flowResult.flowId!;

    // 1. Attach evidence
    const evReq = new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({
        type: "TEXT",
        data: { content: "Some evidence" },
        idempotencyKey: "key-1"
      })
    });
    const evRes = await evidenceRoute.POST(evReq, { params: Promise.resolve({ flowId, taskId: task.id }) });
    expect(evRes.status).toBe(201);

    // 2. Start task
    await startRoute.POST(new NextRequest("http://localhost/api", { method: "POST" }), { params: Promise.resolve({ flowId, taskId: task.id }) });

    // 3. Record outcome
    const req = new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ outcome: "DONE" })
    });
    const res = await outcomeRoute.POST(req, { params: Promise.resolve({ flowId, taskId: task.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("should handle evidence idempotency", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    const { wf, task } = await setupWorkflowWithEvidence(company.id, true);
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_ev_3" }, company.id);
    const flowId = flowResult.flowId!;

    const payload = {
      type: "TEXT",
      data: { content: "Idempotent evidence" },
      idempotencyKey: "key-idempotent"
    };

    // First call
    const res1 = await evidenceRoute.POST(
      new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(payload) }),
      { params: Promise.resolve({ flowId, taskId: task.id }) }
    );
    const data1 = await res1.json();
    expect(res1.status).toBe(201);

    // Second call with same key
    const res2 = await evidenceRoute.POST(
      new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(payload) }),
      { params: Promise.resolve({ flowId, taskId: task.id }) }
    );
    const data2 = await res2.json();
    
    expect(res2.status).toBe(201);
    expect(data2.evidence.id).toBe(data1.evidence.id);
  });

  it("should filter by flow group (job drill-down)", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    const { wf, task } = await setupWorkflowWithEvidence(company.id, false);
    
    const fg1 = { type: "job", id: "job_a" };
    const fg2 = { type: "job", id: "job_b" };
    
    const flowA = await Instantiation.createFlow(wf.id, fg1, company.id);
    const flowB = await Instantiation.createFlow(wf.id, fg2, company.id);
    
    // Get FlowGroup IDs from created flows
    const flowARecord = await prisma.flow.findUnique({ where: { id: flowA.flowId }, select: { flowGroupId: true } });
    const flowBRecord = await prisma.flow.findUnique({ where: { id: flowB.flowId }, select: { flowGroupId: true } });
    
    const fgIdA = flowARecord!.flowGroupId;
    const fgIdB = flowBRecord!.flowGroupId;

    // 1. Query global tasks
    const globalRes = await actionableTasksRoute.GET(new NextRequest("http://localhost/api"));
    const globalData = await globalRes.json();
    expect(globalData.items.length).toBe(2);

    // 2. Query scoped to Job A
    const scopedResA = await flowGroupTasksRoute.GET(
      new NextRequest("http://localhost/api"),
      { params: Promise.resolve({ id: fgIdA }) }
    );
    const scopedDataA = await scopedResA.json();
    expect(scopedDataA.items.length).toBe(1);
    expect(scopedDataA.items[0].flowGroupId).toBe(fgIdA);

    // 3. Query scoped to Job B
    const scopedResB = await flowGroupTasksRoute.GET(
      new NextRequest("http://localhost/api"),
      { params: Promise.resolve({ id: fgIdB }) }
    );
    const scopedDataB = await scopedResB.json();
    expect(scopedDataB.items.length).toBe(1);
    expect(scopedDataB.items[0].flowGroupId).toBe(fgIdB);
  });
});
