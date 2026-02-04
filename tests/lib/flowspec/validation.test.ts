/**
 * FlowSpec Workflow Validation Tests
 *
 * Epic: EPIC-02 FlowSpec Workflow Validation
 * Canon Source: 10_flowspec_engine_contract.md §8
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { validateWorkflow } from "@/lib/flowspec/validation";
import type { WorkflowWithRelations } from "@/lib/flowspec/types";
import { CompletionRule, WorkflowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.taskPolicyOverride.deleteMany({});
  await prisma.flowGroupPolicy.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.validityEvent.deleteMany({});
  await prisma.detourRecord.deleteMany({});
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

describe("EPIC-02: FlowSpec Workflow Validation", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should detect missing Entry Node", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "No Entry Workflow",
        companyId: company.id,
      },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(workflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "NO_ENTRY_NODE")).toBe(true);
  });

  it("should detect unreachable nodes", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Unreachable Workflow",
        companyId: company.id,
        nodes: {
          create: [
            { name: "Entry", isEntry: true },
            { name: "Unreachable", isEntry: false }
          ]
        }
      },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(workflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "UNREACHABLE_NODE")).toBe(true);
  });

  it("should detect tasks with zero outcomes", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "No Outcomes Workflow",
        companyId: company.id,
        nodes: {
          create: [
            { 
              name: "Entry", 
              isEntry: true,
              tasks: {
                create: [
                  { name: "Task with no outcomes" }
                ]
              }
            }
          ]
        }
      },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(workflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "NO_OUTCOMES_DEFINED")).toBe(true);
  });

  it("should detect outcomes without gate routes", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Orphaned Outcome Workflow",
        companyId: company.id,
        nodes: {
          create: [
            { 
              name: "Entry", 
              isEntry: true,
              tasks: {
                create: [
                  { 
                    name: "Task",
                    outcomes: { create: [{ name: "DONE" }] }
                  }
                ]
              }
            }
          ]
        }
      },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(workflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "ORPHANED_OUTCOME")).toBe(true);
  });

  it("should detect conflicting gate routes in same node", async () => {
    const company = await createTestCompany();
    
    // Setup: Node with two tasks, both have "DONE" outcome but routing to different targets
    // We construct this in-memory because Prisma unique constraints prevent saving it
    const workflow: any = {
      id: "w-conflict",
      name: "Conflict Workflow",
      companyId: company.id,
      isNonTerminating: false,
      nodes: [
        {
          id: "n1",
          name: "N1",
          isEntry: true,
          tasks: [
            { id: "t1", name: "T1", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] },
            { id: "t2", name: "T2", outcomes: [{ name: "DONE" }], crossFlowDependencies: [] }
          ]
        },
        { id: "n2", name: "N2", tasks: [], outcomes: [] },
        { id: "n3", name: "N3", tasks: [], outcomes: [] }
      ],
      gates: [
        { id: "g1", sourceNodeId: "n1", outcomeName: "DONE", targetNodeId: "n2" },
        { id: "g2", sourceNodeId: "n1", outcomeName: "DONE", targetNodeId: "n3" }
      ],
      fanOutRules: []
    };

    const result = await validateWorkflow(workflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "CONFLICTING_GATE_ROUTES")).toBe(true);
  });

  it("should detect missing terminal path", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "No Terminal Workflow",
        companyId: company.id,
        isNonTerminating: false,
      },
      include: { nodes: true }
    });

    const n1 = await prisma.node.create({ data: { workflowId: workflow.id, name: "N1", isEntry: true } });
    const n2 = await prisma.node.create({ data: { workflowId: workflow.id, name: "N2" } });

    await prisma.task.create({
      data: {
        nodeId: n1.id,
        name: "T1",
        outcomes: { create: [{ name: "NEXT" }] }
      }
    });

    // Path N1 -> N2, but N2 has no outcomes leading to terminal
    await prisma.gate.create({ data: { workflowId: workflow.id, sourceNodeId: n1.id, outcomeName: "NEXT", targetNodeId: n2.id } });

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(fullWorkflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "NO_TERMINAL_PATH")).toBe(true);
  });

  it("should pass a valid simple workflow", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Valid Workflow",
        companyId: company.id,
      },
      include: { nodes: true }
    });

    const n1 = await prisma.node.create({ data: { workflowId: workflow.id, name: "N1", isEntry: true } });

    await prisma.task.create({
      data: {
        nodeId: n1.id,
        name: "T1",
        outcomes: { create: [{ name: "DONE" }] }
      }
    });

    await prisma.gate.create({ data: { workflowId: workflow.id, sourceNodeId: n1.id, outcomeName: "DONE", targetNodeId: null } });

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(fullWorkflow as WorkflowWithRelations);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should detect circular cross-flow dependency", async () => {
    const company = await createTestCompany();
    const workflow = await prisma.workflow.create({
      data: {
        name: "Circular Cross-Flow",
        companyId: company.id,
      },
    });

    const n1 = await prisma.node.create({ data: { workflowId: workflow.id, name: "N1", isEntry: true } });
    const t1 = await prisma.task.create({ data: { nodeId: n1.id, name: "T1" } });
    await prisma.outcome.create({ data: { taskId: t1.id, name: "DONE" } });
    await prisma.gate.create({ data: { workflowId: workflow.id, sourceNodeId: n1.id, outcomeName: "DONE", targetNodeId: null } });

    // Circular: T1 depends on T1.DONE
    await prisma.crossFlowDependency.create({
      data: {
        taskId: t1.id,
        sourceWorkflowId: workflow.id,
        sourceTaskPath: `${n1.id}.${t1.id}`,
        requiredOutcome: "DONE"
      }
    });

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: {
        nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
        gates: true,
        fanOutRules: true,
      }
    });

    const result = await validateWorkflow(fullWorkflow as WorkflowWithRelations);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "CIRCULAR_DEPENDENCY")).toBe(true);
  });

  describe("INV-025: Evidence Schema Enforcement", () => {
    it("should yield no findings for DRAFT with missing schema", async () => {
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "Draft Evidence Workflow",
          companyId: company.id,
          status: WorkflowStatus.DRAFT,
          nodes: {
            create: [
              { 
                name: "Entry", 
                isEntry: true,
                tasks: {
                  create: [
                    { 
                      name: "T1",
                      evidenceRequired: true,
                      evidenceSchema: null,
                      outcomes: { create: [{ name: "DONE" }] }
                    }
                  ]
                }
              }
            ]
          }
        },
        include: {
          nodes: { include: { tasks: true } }
        }
      });

      const node = workflow.nodes[0];
      await prisma.gate.create({
        data: {
          workflowId: workflow.id,
          sourceNodeId: node.id,
          outcomeName: "DONE",
          targetNodeId: null
        }
      });

      const updatedWorkflow = await prisma.workflow.findUnique({
        where: { id: workflow.id },
        include: {
          nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
          gates: true,
          fanOutRules: true,
        }
      });

      const result = await validateWorkflow(updatedWorkflow as WorkflowWithRelations);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should yield error for VALIDATED with missing schema", async () => {
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "Validated Evidence Workflow",
          companyId: company.id,
          status: WorkflowStatus.VALIDATED,
          nodes: {
            create: [
              { 
                name: "Entry", 
                isEntry: true,
                tasks: {
                  create: [
                    { 
                      name: "T1",
                      evidenceRequired: true,
                      evidenceSchema: null,
                      outcomes: { create: [{ name: "DONE" }] }
                    }
                  ]
                }
              }
            ]
          }
        },
        include: {
          nodes: { include: { tasks: true } }
        }
      });

      const node = workflow.nodes[0];
      await prisma.gate.create({
        data: {
          workflowId: workflow.id,
          sourceNodeId: node.id,
          outcomeName: "DONE",
          targetNodeId: null
        }
      });

      const updatedWorkflow = await prisma.workflow.findUnique({
        where: { id: workflow.id },
        include: {
          nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
          gates: true,
          fanOutRules: true,
        }
      });

      const result = await validateWorkflow(updatedWorkflow as WorkflowWithRelations);
      expect(result.valid).toBe(false);
      const inv025 = result.errors.find(e => e.code === "MISSING_EVIDENCE_SCHEMA");
      expect(inv025).toBeDefined();
      expect(inv025?.severity).toBe("error");
    });
  });

  describe("Warning Blocking Regression", () => {
    it("should block validation when a warning (EMPTY_SPECIFIC_TASKS) is present", async () => {
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "Warning Workflow",
          companyId: company.id,
          nodes: {
            create: [
              { 
                name: "Entry", 
                isEntry: true,
                completionRule: CompletionRule.SPECIFIC_TASKS_DONE,
                specificTasks: [], // This triggers the warning in semantic.ts
                tasks: {
                  create: [
                    { 
                      name: "T1",
                      outcomes: { create: [{ name: "DONE" }] }
                    }
                  ]
                }
              }
            ]
          }
        },
        include: {
          nodes: { include: { tasks: true } }
        }
      });

      const node = workflow.nodes[0];
      await prisma.gate.create({
        data: {
          workflowId: workflow.id,
          sourceNodeId: node.id,
          outcomeName: "DONE",
          targetNodeId: null
        }
      });

      const updatedWorkflow = await prisma.workflow.findUnique({
        where: { id: workflow.id },
        include: {
          nodes: { include: { tasks: { include: { outcomes: true, crossFlowDependencies: true } }, outboundGates: true, inboundGates: true } },
          gates: true,
          fanOutRules: true,
        }
      });

      const result = await validateWorkflow(updatedWorkflow as WorkflowWithRelations);
      expect(result.valid).toBe(false);
      const warning = result.errors.find(e => e.code === "EMPTY_SPECIFIC_TASKS");
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe("warning");
    });
  });
});
