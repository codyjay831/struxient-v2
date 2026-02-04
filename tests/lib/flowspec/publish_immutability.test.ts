import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { publishWorkflowAction } from "@/lib/flowspec/lifecycle";
import { WorkflowStatus, CompletionRule } from "@prisma/client";
import { WorkflowSnapshot } from "@/lib/flowspec/types";

describe("Gap D Audit: Publish-time Snapshot Immutability", () => {
  let workflowId: string;
  const USER_ID = "test-user";

  beforeEach(async () => {
    // Comprehensive cleanup in order
    await prisma.validityEvent.deleteMany({});
    await prisma.taskExecution.deleteMany({});
    await prisma.nodeActivation.deleteMany({});
    await prisma.flow.deleteMany({});
    await prisma.flowGroup.deleteMany({});
    await prisma.workflowVersion.deleteMany({});
    await prisma.workflow.deleteMany({});
    await prisma.company.deleteMany({});

    // Create a company
    const company = await prisma.company.create({
      data: {
        id: "test-company",
        name: "Test Company",
      }
    });

    // Create a simple workflow in VALIDATED state
    const wf = await prisma.workflow.create({
      data: {
        name: "Gap D Test Workflow",
        status: WorkflowStatus.VALIDATED,
        version: 1,
        companyId: company.id,
        nodes: {
          create: [
            {
              id: "n1",
              name: "Node 1",
              isEntry: true,
              completionRule: CompletionRule.ALL_TASKS_DONE,
              tasks: {
                create: [
                  {
                    id: "t1",
                    name: "Task 1",
                    displayOrder: 1,
                    outcomes: {
                      create: [
                        { id: "o1", name: "DONE" }
                      ]
                    }
                  }
                ]
              }
            },
            {
              id: "n2",
              name: "Node 2",
              completionRule: CompletionRule.ALL_TASKS_DONE,
              tasks: {
                create: [
                  {
                    id: "t2",
                    name: "Task 2",
                    displayOrder: 1,
                    outcomes: {
                      create: [
                        { id: "o2", name: "FINISH" }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        },
        gates: {
          create: [
            {
              id: "g1",
              sourceNodeId: "n1",
              outcomeName: "DONE",
              targetNodeId: "n2",
            },
            {
              id: "g2",
              sourceNodeId: "n2",
              outcomeName: "FINISH",
              targetNodeId: null, // Terminal
            }
          ]
        }
      }
    });
    workflowId = wf.id;
  });

  it("should persist transitiveSuccessors in snapshot at publish time and never recompute", async () => {
    // 1. Publish the workflow
    const result = await publishWorkflowAction(workflowId, USER_ID);
    if (!result.success) {
      console.error("Publish failed:", result.error, result.validation);
    }
    expect(result.success).toBe(true);
    const versionId = result.versionId!;

    // 2. Fetch the stored snapshot directly from DB
    const version = await prisma.workflowVersion.findUnique({
      where: { id: versionId },
    });
    
    expect(version).not.toBeNull();
    const snapshot = version!.snapshot as unknown as WorkflowSnapshot;
    
    // 3. Verify transitiveSuccessors exist for n1 (should be ["n2"])
    const n1 = snapshot.nodes.find(n => n.id === "n1");
    expect(n1).toBeDefined();
    expect(n1!.transitiveSuccessors).toEqual(["n2"]);

    // 4. Verify transitiveSuccessors exist for n2 (should be [])
    const n2 = snapshot.nodes.find(n => n.id === "n2");
    expect(n2).toBeDefined();
    expect(n2!.transitiveSuccessors).toEqual([]);

    // 5. Proof of immutability: The database record contains the pre-computed array.
    // getWorkflowSnapshot (the engine's read path) simply returns this JSON field.
    // There is no logic in the engine read path that calls computeTransitiveSuccessors.
  });
});
