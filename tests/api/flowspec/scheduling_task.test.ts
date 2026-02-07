import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOutcome, startTask } from "@/lib/flowspec/engine";
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
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.detourRecord.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Scheduling Task v1 (Phase G)", () => {
  const MOCK_USER_ID = "user_scheduling_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should commit a ScheduleBlock from a scheduling task outcome", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Setup Workflow with scheduling task
    const wf = await prisma.workflow.create({
      data: {
        name: "Scheduling WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [
            { 
              name: "N1", 
              isEntry: true, 
              tasks: { 
                create: { 
                  name: "Schedule Task", 
                  metadata: { scheduling: { enabled: true, type: "INSTALL_APPOINTMENT" } },
                  outcomes: { create: { name: "DONE" } } 
                } 
              } 
            }
          ]
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const t1 = wf.nodes[0].tasks[0];

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
        tasks: n.tasks.map(t => ({ 
          id: t.id, 
          name: t.name, 
          metadata: t.metadata,
          outcomes: [{ name: "DONE" }], 
          crossFlowDependencies: [] 
        }))
      })),
      gates: []
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_scheduling" }, company.id);
    const flowId = flowResult.flowId!;

    // 2. Start Task
    await startTask(flowId, t1.id, MOCK_USER_ID);

    // 3. Record Outcome with schedule metadata (Restore canonical shape)
    const metadata = {
      schedule: {
        startAt: "2026-03-01T10:00:00Z",
        endAt: "2026-03-01T12:00:00Z",
        metadata: { note: "Test note" }
      }
    };

    const result = await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, undefined, metadata);
    expect(result.success).toBe(true);

    // 4. Verify ScheduleBlock
    const block = await prisma.scheduleBlock.findFirst({
      where: { taskId: t1.id, companyId: company.id, supersededAt: null }
    });

    expect(block).not.toBeNull();
    expect(block?.startAt.toISOString()).toBe("2026-03-01T10:00:00.000Z");
    expect(block?.endAt.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(block?.createdBy).toBe(MOCK_USER_ID);
    expect((block?.metadata as any)?.note).toBe("Test note");
  });

  it("should supersede previous block on second commit", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: {
        name: "Cycle WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [
            { 
              name: "N1", 
              isEntry: true, 
              tasks: { 
                create: { 
                  name: "Repeat Task", 
                  metadata: { scheduling: { enabled: true, type: "SITE_VISIT" } },
                  outcomes: { create: { name: "REDO" } } 
                } 
              } 
            }
          ]
        }
      },
      include: { nodes: { include: { tasks: { include: { outcomes: true } } } } }
    });

    const n1 = wf.nodes[0];
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
        tasks: n.tasks.map(t => ({ 
          id: t.id, 
          name: t.name, 
          metadata: t.metadata,
          outcomes: t.outcomes.map(o => ({ name: o.name })),
          crossFlowDependencies: [] 
        }))
      })),
      gates: [
        { id: "G1", sourceNodeId: n1.id, outcomeName: "REDO", targetNodeId: n1.id }
      ]
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_cycle" }, company.id);
    const flowId = flowResult.flowId!;

    // Commit 1
    await startTask(flowId, t1.id, MOCK_USER_ID);
    await recordOutcome(flowId, t1.id, "REDO", MOCK_USER_ID, undefined, {
      schedule: { startAt: "2026-04-01T10:00:00Z", endAt: "2026-04-01T11:00:00Z" }
    });

    const block1 = await prisma.scheduleBlock.findFirst({
      where: { taskId: t1.id, supersededAt: null }
    });
    expect(block1).not.toBeNull();

    // Commit 2 (Iteration 2)
    await startTask(flowId, t1.id, MOCK_USER_ID);
    await recordOutcome(flowId, t1.id, "REDO", MOCK_USER_ID, undefined, {
      schedule: { startAt: "2026-04-02T10:00:00Z", endAt: "2026-04-02T11:00:00Z" }
    });

    const block2 = await prisma.scheduleBlock.findFirst({
      where: { taskId: t1.id, supersededAt: null }
    });
    expect(block2?.startAt.toISOString()).toBe("2026-04-02T10:00:00.000Z");

    const block1Updated = await prisma.scheduleBlock.findUnique({ where: { id: block1!.id } });
    expect(block1Updated?.supersededAt).not.toBeNull();
    expect(block1Updated?.supersededBy).toBe(block2?.id);
  });

  it("should fail recordOutcome if scheduling data is missing for a scheduling task", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: {
        name: "Mandatory WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [{ 
            name: "N1", isEntry: true, 
            tasks: { create: { 
              name: "T1", metadata: { scheduling: { enabled: true, type: "OTHER" } },
              outcomes: { create: { name: "DONE" } } 
            } } 
          }]
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", metadata: t1.metadata, outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_mandatory" }, company.id);
    const flowId = flowResult.flowId!;

    await startTask(flowId, t1.id, MOCK_USER_ID);
    
    // MISSING metadata entirely
    const result = await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, undefined, {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("SCHEDULING_DATA_MISSING");

    const blocks = await prisma.scheduleBlock.findMany({ where: { taskId: t1.id } });
    expect(blocks.length).toBe(0);
  });

  it("should fail recordOutcome if payload is invalid (end <= start)", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: {
        name: "Invalid WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [{ 
            name: "N1", isEntry: true, 
            tasks: { create: { 
              name: "T1", metadata: { scheduling: { enabled: true, type: "OTHER" } },
              outcomes: { create: { name: "DONE" } } 
            } } 
          }]
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", metadata: t1.metadata, outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_invalid" }, company.id);
    const flowId = flowResult.flowId!;

    await startTask(flowId, t1.id, MOCK_USER_ID);
    
    // Inverted times
    const result = await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, undefined, {
      schedule: { startAt: "2026-05-01T12:00:00Z", endAt: "2026-05-01T10:00:00Z" }
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_TIME_RANGE");

    const blocks = await prisma.scheduleBlock.findMany({ where: { taskId: t1.id } });
    expect(blocks.length).toBe(0);
  });

  it("should NOT support Live Override: fail commit if snapshot is disabled even if payload provided", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Workflow with scheduling DISABLED in snapshot
    const wf = await prisma.workflow.create({
      data: {
        name: "No Override WF",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: [{ 
            name: "N1", isEntry: true, 
            tasks: { create: { 
              name: "T1", metadata: { scheduling: { enabled: false } },
              outcomes: { create: { name: "DONE" } } 
            } } 
          }]
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", metadata: t1.metadata, outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_no_override" }, company.id);
    const flowId = flowResult.flowId!;

    await startTask(flowId, t1.id, MOCK_USER_ID);
    
    // Provide scheduling payload anyway
    const result = await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, undefined, {
      schedule: { startAt: "2026-06-01T10:00:00Z", endAt: "2026-06-01T11:00:00Z" }
    });
    expect(result.success).toBe(true); // Task succeeds

    // BUT NO ScheduleBlock should be created
    const block = await prisma.scheduleBlock.findFirst({ where: { taskId: t1.id } });
    expect(block).toBeNull();
  });

  it("should enforce tenant isolation", async () => {
    const companyA = await createTestCompany("Company A");
    await createTestMember(companyA.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Workflow in Company A
    const wf = await prisma.workflow.create({
      data: {
        name: "A WF", companyId: companyA.id, status: WorkflowStatus.PUBLISHED,
        nodes: { create: [{ name: "N1", isEntry: true, tasks: { create: { name: "T1", metadata: { scheduling: { enabled: true, type: "OTHER" } }, outcomes: { create: { name: "DONE" } } } } }] }
      },
      include: { nodes: { include: { tasks: true } } }
    });
    const t1 = wf.nodes[0].tasks[0];
    const snapshot = {
      workflowId: wf.id, version: 1, name: wf.name,
      nodes: [{ id: wf.nodes[0].id, name: "N1", isEntry: true, nodeKind: "MAINLINE", completionRule: "ALL_TASKS_DONE", tasks: [{ id: t1.id, name: "T1", metadata: t1.metadata, outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }],
      gates: []
    };
    await prisma.workflowVersion.create({ data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID } });
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_a" }, companyA.id);
    const flowId = flowResult.flowId!;

    await startTask(flowId, t1.id, MOCK_USER_ID);
    await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, undefined, {
      schedule: { startAt: "2026-06-01T10:00:00Z", endAt: "2026-06-01T11:00:00Z" }
    });

    const block = await prisma.scheduleBlock.findFirst({ where: { taskId: t1.id } });
    expect(block?.companyId).toBe(companyA.id);
  });

  it("should ignore scheduling if no payload is sent for a non-scheduling task", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const wf = await prisma.workflow.create({
      data: {
        name: "Normal WF", companyId: company.id, status: WorkflowStatus.PUBLISHED,
        nodes: { create: [{ name: "N1", isEntry: true, tasks: { create: { name: "Normal Task", outcomes: { create: { name: "DONE" } } } } }] }
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
    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_normal" }, company.id);
    const flowId = flowResult.flowId!;

    await startTask(flowId, t1.id, MOCK_USER_ID);
    
    // NO scheduling payload
    await recordOutcome(flowId, t1.id, "DONE", MOCK_USER_ID, undefined, {});

    const blocks = await prisma.scheduleBlock.findMany({ where: { taskId: t1.id } });
    expect(blocks.length).toBe(0);
  });
});
