import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOutcome } from "@/lib/flowspec/engine";
import { WorkflowStatus, FlowStatus } from "@prisma/client";
import * as truth from "@/lib/flowspec/truth";
import * as Instantiation from "@/lib/flowspec/instantiation";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("Execution Core: Atomicity (GAP-01)", () => {
  const MOCK_USER_ID = "user_123";
  let testFlowId: string;
  let testTaskId: string;
  let nextNodeId: string;

  beforeEach(async () => {
    // Cleanup
    await prisma.taskExecution.deleteMany();
    await prisma.nodeActivation.deleteMany();
    await prisma.flow.deleteMany();
    await prisma.flowGroup.deleteMany();
    await prisma.workflowVersion.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.companyMember.deleteMany();
    await prisma.company.deleteMany();

    // Setup: 1 Task -> 1 Gate -> 1 Next Node
    const company = await prisma.company.create({ data: { name: "Atomicity Test Co" } });
    await prisma.companyMember.create({
      data: { companyId: company.id, userId: MOCK_USER_ID, role: "OWNER" }
    });

    const wf = await prisma.workflow.create({
      data: {
        name: "Atomicity Workflow",
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
              tasks: { create: { name: "T2", outcomes: { create: { name: "DONE" } } } }
            }
          ]
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const n1 = wf.nodes.find(n => n.name === "N1")!;
    const n2 = wf.nodes.find(n => n.name === "N2")!;
    nextNodeId = n2.id;
    testTaskId = n1.tasks[0].id;

    await prisma.gate.create({
      data: { workflowId: wf.id, sourceNodeId: n1.id, outcomeName: "GO", targetNodeId: n2.id }
    });

    const snapshot = {
      workflowId: wf.id,
      version: 1,
      name: wf.name,
      nodes: [
        { id: n1.id, name: "N1", isEntry: true, completionRule: "ALL_TASKS_DONE", tasks: [{ id: testTaskId, name: "T1", outcomes: [{ name: "GO" }], crossFlowDependencies: [] }] },
        { id: n2.id, name: "N2", isEntry: false, completionRule: "ALL_TASKS_DONE", tasks: [{ id: n2.tasks[0].id, name: "T2", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }] }
      ],
      gates: [{ id: "gate_1", sourceNodeId: n1.id, outcomeName: "GO", targetNodeId: n2.id }]
    };
    await prisma.workflowVersion.create({
      data: { workflowId: wf.id, version: 1, snapshot: snapshot as any, publishedBy: MOCK_USER_ID }
    });

    const flowResult = await Instantiation.createFlow(wf.id, { type: "job", id: "job_atomicity" }, company.id);
    testFlowId = flowResult.flowId!;

    // Start Task T1
    await prisma.taskExecution.create({
      data: { flowId: testFlowId, taskId: testTaskId, startedAt: new Date(), startedBy: MOCK_USER_ID, iteration: 1 }
    });
  });

  it("T-Execution-Atomicity: Rolls back outcome and activations on routing failure", async () => {
    // 1. Spies/Mocks
    const originalRecordNodeActivation = truth.recordNodeActivation;
    const recordNodeActivationSpy = vi.spyOn(truth, "recordNodeActivation");
    
    // Force failure during Node Activation (Write #2)
    recordNodeActivationSpy.mockImplementationOnce(() => {
      throw new Error("SIMULATED_ROUTING_FAILURE");
    });

    // 2. Execute recordOutcome
    await expect(recordOutcome(testFlowId, testTaskId, "GO", MOCK_USER_ID))
      .rejects.toThrow("SIMULATED_ROUTING_FAILURE");

    // 3. Verify Rollback (Atomic Unit)
    // Write #1 (Outcome) should be rolled back
    const execution = await prisma.taskExecution.findFirst({
      where: { flowId: testFlowId, taskId: testTaskId }
    });
    expect(execution?.outcome).toBeNull();

    // Write #2 (Node Activation) should not exist
    const nextActivation = await prisma.nodeActivation.findFirst({
      where: { flowId: testFlowId, nodeId: nextNodeId }
    });
    expect(nextActivation).toBeNull();

    // Write #3 (Flow Status) should still be ACTIVE
    const flow = await prisma.flow.findUnique({ where: { id: testFlowId } });
    expect(flow?.status).toBe(FlowStatus.ACTIVE);

    // 4. Subsequent retry succeeds
    recordNodeActivationSpy.mockImplementation(originalRecordNodeActivation);
    const retryResult = await recordOutcome(testFlowId, testTaskId, "GO", MOCK_USER_ID);
    
    expect(retryResult.success).toBe(true);
    const finalExecution = await prisma.taskExecution.findFirst({
      where: { flowId: testFlowId, taskId: testTaskId }
    });
    expect(finalExecution?.outcome).toBe("GO");
    
    const finalActivation = await prisma.nodeActivation.findFirst({
      where: { flowId: testFlowId, nodeId: nextNodeId }
    });
    expect(finalActivation).not.toBeNull();
  });
});
