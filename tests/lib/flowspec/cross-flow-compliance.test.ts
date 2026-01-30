import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { validateWorkflow } from "@/lib/flowspec/validation";
import type { WorkflowWithRelations } from "@/lib/flowspec/types";
import { WorkflowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Compliance Co") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.crossFlowDependency.deleteMany({});
  await prisma.outcome.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("CrossFlowDependency Compliance", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should reject name-based sourceTaskPath", async () => {
    const company = await createTestCompany();
    
    // Create source workflow
    const sourceWf = await prisma.workflow.create({
      data: {
        name: "Source",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        nodes: {
          create: {
            name: "Node",
            isEntry: true,
            tasks: {
              create: {
                name: "TargetTask",
                outcomes: { create: { name: "DONE" } }
              }
            }
          }
        }
      }
    });

    // Create target workflow with name-based dependency
    const targetWf = await prisma.workflow.create({
      data: {
        name: "Target",
        companyId: company.id,
        nodes: {
          create: {
            name: "Entry",
            isEntry: true,
            tasks: {
              create: {
                name: "Task"
              }
            }
          }
        }
      },
      include: { nodes: { include: { tasks: true } } }
    });

    const task = targetWf.nodes[0].tasks[0];
    await prisma.crossFlowDependency.create({
      data: {
        taskId: task.id,
        sourceWorkflowId: sourceWf.id,
        sourceTaskPath: "TargetTask", // Name instead of ID
        requiredOutcome: "DONE"
      }
    });

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: targetWf.id },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(fullWorkflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "INVALID_TASK_PATH_FORMAT")).toBe(true);
  });

  it("should reject raw taskId sourceTaskPath (missing nodeId)", async () => {
    const company = await createTestCompany();
    const sourceWf = await prisma.workflow.create({
        data: { name: "S", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const node = await prisma.node.create({ data: { workflowId: sourceWf.id, name: "N", isEntry: true } });
    const taskS = await prisma.task.create({ data: { nodeId: node.id, name: "T" } });

    const targetWf = await prisma.workflow.create({
        data: { name: "T", companyId: company.id }
    });
    const nodeT = await prisma.node.create({ data: { workflowId: targetWf.id, name: "N", isEntry: true } });
    const taskT = await prisma.task.create({ data: { nodeId: nodeT.id, name: "T" } });

    await prisma.crossFlowDependency.create({
      data: {
        taskId: taskT.id,
        sourceWorkflowId: sourceWf.id,
        sourceTaskPath: taskS.id, // Only taskId, missing nodeId.
        requiredOutcome: "DONE"
      }
    });

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: targetWf.id },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(fullWorkflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "INVALID_TASK_PATH_FORMAT")).toBe(true);
  });

  it("should pass valid nodeId.taskId format", async () => {
    const company = await createTestCompany();
    const sourceWf = await prisma.workflow.create({
        data: { name: "S", companyId: company.id, status: WorkflowStatus.PUBLISHED }
    });
    const node = await prisma.node.create({ data: { workflowId: sourceWf.id, name: "N", isEntry: true } });
    const taskS = await prisma.task.create({ data: { nodeId: node.id, name: "T" } });
    await prisma.outcome.create({ data: { taskId: taskS.id, name: "DONE" } });

    const targetWf = await prisma.workflow.create({
        data: { name: "T", companyId: company.id }
    });
    const nodeT = await prisma.node.create({ data: { workflowId: targetWf.id, name: "N", isEntry: true } });
    const taskT = await prisma.task.create({ data: { nodeId: nodeT.id, name: "T" } });
    await prisma.gate.create({ data: { workflowId: targetWf.id, sourceNodeId: nodeT.id, outcomeName: "ANY", targetNodeId: null } });

    await prisma.crossFlowDependency.create({
      data: {
        taskId: taskT.id,
        sourceWorkflowId: sourceWf.id,
        sourceTaskPath: `${node.id}.${taskS.id}`,
        requiredOutcome: "DONE"
      }
    });

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: targetWf.id },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(fullWorkflow as WorkflowWithRelations);
    // Might have other errors (like NO_ENTRY_NODE if I didn't set it up perfectly)
    // but should NOT have INVALID_TASK_PATH_FORMAT or SOURCE_TASK_NOT_FOUND
    expect(result.errors.some(e => e.code === "INVALID_TASK_PATH_FORMAT")).toBe(false);
    expect(result.errors.some(e => e.code === "SOURCE_TASK_NOT_FOUND")).toBe(false);
  });
});
