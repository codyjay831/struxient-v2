/**
 * Policy Deduplication & Scope Locking Tests
 * 
 * Proves INV-033: Policy is scoped to FlowGroup + taskId (v1).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as snapshotTasksRoute from "@/app/api/flowspec/flow-groups/[id]/snapshot-tasks/route";
import * as actionableTasksRoute from "@/app/api/flowspec/actionable-tasks/route";
import * as policyRoute from "@/app/api/flowspec/flow-groups/[id]/policy/route";
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

describe("Policy v1 Scope Locking (INV-033)", () => {
  const MOCK_USER_ID = "user_policy_dedupe";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should dedupe by taskId across flows and apply overrides uniformly", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Create a FlowGroup
    const fg = await prisma.flowGroup.create({
      data: {
        scopeType: "test",
        scopeId: "scope_3",
        companyId: company.id
      }
    });

    // 2. Create 2 workflows with the SAME taskId "shared-task"
    const sharedTaskId = "shared-task-id";
    
    // W1
    const wf1 = await prisma.workflow.create({
      data: { 
        name: "W1", 
        companyId: company.id, 
        status: "PUBLISHED", 
        version: 1,
        nodes: {
          create: {
            name: "N1",
            isEntry: true,
            tasks: {
              create: { id: sharedTaskId, name: "Task in W1", defaultSlaHours: 10 }
            }
          }
        }
      }
    });
    const snapshot1 = {
      workflowId: wf1.id, version: 1, name: "W1", isNonTerminating: false,
      nodes: [{
        id: "n1-id", name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE",
        tasks: [{ id: sharedTaskId, name: "Task in W1", defaultSlaHours: 10, displayOrder: 0, evidenceRequired: false, outcomes: [] }]
      }],
      gates: []
    };
    const wv1 = await prisma.workflowVersion.create({
      data: { workflowId: wf1.id, version: 1, snapshot: snapshot1 as any, publishedBy: MOCK_USER_ID }
    });

    // W2
    const wf2 = await prisma.workflow.create({
      data: { 
        name: "W2", 
        companyId: company.id, 
        status: "PUBLISHED", 
        version: 1,
        nodes: {
          create: {
            name: "N2",
            isEntry: true,
            tasks: {
              create: { id: sharedTaskId + "-w2", name: "Task in W2", defaultSlaHours: 20 }
            }
          }
        }
      }
    });
    // Note: In the DB, Task.id is unique. But in the SNAPSHOT (which Policy uses), we can have the same ID.
    // The policy API validates against the snapshot.
    const snapshot2 = {
      workflowId: wf2.id, version: 1, name: "W2", isNonTerminating: false,
      nodes: [{
        id: "n2-id", name: "N2", isEntry: true, completionRule: "ALL_TASKS_DONE",
        tasks: [{ id: sharedTaskId, name: "Task in W2", defaultSlaHours: 20, displayOrder: 0, evidenceRequired: false, outcomes: [] }]
      }],
      gates: []
    };
    const wv2 = await prisma.workflowVersion.create({
      data: { workflowId: wf2.id, version: 1, snapshot: snapshot2 as any, publishedBy: MOCK_USER_ID }
    });

    // 3. Instantiate both in the same FlowGroup
    // We use createFlow to ensure NodeActivations are created so they appear in actionable-tasks
    await Instantiation.createFlow(wf1.id, { type: "test", id: "scope_3" }, company.id);
    await Instantiation.createFlow(wf2.id, { type: "test", id: "scope_3" }, company.id);

    // 4. Prove snapshot-tasks dedupes
    const reqSnapshot = new NextRequest(`http://localhost/api/flowspec/flow-groups/${fg.id}/snapshot-tasks`);
    const resSnapshot = await snapshotTasksRoute.GET(reqSnapshot, { params: Promise.resolve({ id: fg.id }) });
    const dataSnapshot = await resSnapshot.json();
    
    expect(dataSnapshot.tasks).toHaveLength(1);
    expect(dataSnapshot.tasks[0].taskId).toBe(sharedTaskId);

    // 5. Apply SLA override for that taskId
    const reqPolicy = new NextRequest(`http://localhost/api/flowspec/flow-groups/${fg.id}/policy`, {
      method: "PUT",
      body: JSON.stringify({
        taskOverrides: [{ taskId: sharedTaskId, slaHours: 5 }]
      })
    });
    await policyRoute.PUT(reqPolicy, { params: Promise.resolve({ id: fg.id }) });

    // 6. Prove actionable-tasks applies it to BOTH flows
    const reqActionable = new NextRequest("http://localhost/api/flowspec/actionable-tasks");
    const resActionable = await actionableTasksRoute.GET(reqActionable);
    const dataActionable = await resActionable.json();

    const tasks = dataActionable.items.filter((t: any) => t.taskId === sharedTaskId);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]._signals.effectiveSlaHours).toBe(5);
    expect(tasks[1]._signals.effectiveSlaHours).toBe(5);

    // 7. Confirm canonical ordering preserved (relative order of flows determined by flowId ASC)
    const flowIds = dataActionable.items.map((t: any) => t.flowId);
    expect(flowIds).toHaveLength(2);
    expect(flowIds[0] < flowIds[1]).toBe(true); // Canonical sort: flowId ASC
  });
});
