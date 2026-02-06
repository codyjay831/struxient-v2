/**
 * FlowSpec Evidence System Tests
 *
 * Epic: EPIC-06 FlowSpec Evidence System
 * Canon Source: 10_flowspec_engine_contract.md §5.3
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  startTask,
  recordOutcome,
  attachEvidence,
  activateEntryNodes,
} from "@/lib/flowspec/engine";
import { checkEvidenceRequirements } from "@/lib/flowspec/evidence";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import { CompletionRule, EvidenceType, FlowStatus, WorkflowStatus } from "@prisma/client";

async function createTestCompany(name: string = "Test Company") {
  return prisma.company.create({
    data: { name },
  });
}

async function cleanupTestData() {
  await prisma.validityEvent.deleteMany({});
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

describe("EPIC-06: FlowSpec Evidence System", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should enforce Evidence schema validation during attachment", async () => {
    const company = await createTestCompany();
    
    // Create workflow with evidence schema
    const workflow = await prisma.workflow.create({
      data: {
        name: "Evidence Schema Workflow",
        companyId: company.id,
        status: WorkflowStatus.PUBLISHED,
        version: 1,
        publishedAt: new Date(),
      },
    });

    const node = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: "Start Node",
        isEntry: true,
      },
    });

    const schema = {
      type: "text",
      minLength: 10,
      maxLength: 50
    };

    const task = await prisma.task.create({
      data: {
        nodeId: node.id,
        name: "Evidence Task",
        evidenceRequired: true,
        evidenceSchema: schema as any,
      },
    });

    await prisma.outcome.create({ data: { taskId: task.id, name: "DONE" } });
    await prisma.gate.create({ data: { workflowId: workflow.id, sourceNodeId: node.id, outcomeName: "DONE", targetNodeId: null } });

    const snapshot: WorkflowSnapshot = {
      workflowId: workflow.id,
      version: 1,
      name: workflow.name,
      description: null,
      isNonTerminating: false,
      nodes: [{
        id: node.id,
        name: node.name,
        isEntry: true,
        nodeKind: "MAINLINE",
        completionRule: CompletionRule.ALL_TASKS_DONE,
        specificTasks: [],
        tasks: [{
          id: task.id,
          name: task.name,
          instructions: null,
          evidenceRequired: true,
          evidenceSchema: schema,
          displayOrder: 0,
          outcomes: [{ id: "o1", name: "DONE" }]
        }],
        transitiveSuccessors: [],
      }],
      gates: [{ id: "g1", sourceNodeId: node.id, outcomeName: "DONE", targetNodeId: null }]
    };

    const workflowVersion = await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        snapshot: snapshot as any,
        publishedBy: "test-user"
      }
    });

    const flowGroup = await prisma.flowGroup.create({
      data: { scopeType: "test", scopeId: "test-1", companyId: company.id }
    });

    const flow = await prisma.flow.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: workflowVersion.id,
        flowGroupId: flowGroup.id,
      }
    });

    await activateEntryNodes(flow.id, snapshot);
    await startTask(flow.id, task.id, "test-user");

    // 1. Invalid attachment - too short
    const result1 = await attachEvidence(flow.id, task.id, EvidenceType.TEXT, { content: "too short" }, "test-user");
    expect(result1.error?.code).toBe("INVALID_EVIDENCE_FORMAT");

    // 2. Valid attachment
    const result2 = await attachEvidence(flow.id, task.id, EvidenceType.TEXT, { content: "this is long enough" }, "test-user");
    expect(result2.evidenceAttachment).toBeDefined();

    // 3. Invalid attachment - wrong type
    const result3 = await attachEvidence(
      flow.id, 
      task.id, 
      EvidenceType.FILE, 
      { 
        storageKey: `${company.id}/evidence/${flow.id}/${task.id}/test.jpg`,
        fileName: "test.jpg", 
        mimeType: "image/jpeg", 
        size: 100,
        bucket: "test-bucket"
      }, 
      "test-user"
    );
    expect(result3.error?.code).toBe("INVALID_EVIDENCE_FORMAT");
  });

  it("should satisfy requirements if at least one evidence matches schema", async () => {
    // This tests the logic in requirements.ts where we might have multiple evidence items
    const task: any = {
      id: "t1",
      name: "T1",
      evidenceRequired: true,
      evidenceSchema: { type: "text", minLength: 5 }
    };

    const attachedEvidence: any[] = [
      { type: "TEXT", data: { content: "abc" } }, // Invalid (too short)
      { type: "TEXT", data: { content: "abcdef" } } // Valid
    ];

    const result = checkEvidenceRequirements(task, attachedEvidence);
    expect(result.satisfied).toBe(true);
  });

  it("should fail requirements if no evidence matches schema", async () => {
    const task: any = {
      id: "t1",
      name: "T1",
      evidenceRequired: true,
      evidenceSchema: { type: "text", minLength: 5 }
    };

    const attachedEvidence: any[] = [
      { type: "TEXT", data: { content: "abc" } }
    ];

    const result = checkEvidenceRequirements(task, attachedEvidence);
    expect(result.satisfied).toBe(false);
  });

  describe("Structured Evidence (Ajv)", () => {
    it("should validate valid structured evidence", async () => {
      const company = await createTestCompany();
      const workflow = await prisma.workflow.create({
        data: {
          name: "Structured Evidence Workflow",
          companyId: company.id,
          status: WorkflowStatus.PUBLISHED,
          version: 1,
        },
      });

      const node = await prisma.node.create({
        data: { workflowId: workflow.id, name: "Node 1", isEntry: true },
      });

      const schema = {
        type: "structured",
        jsonSchema: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0 },
            comment: { type: "string" },
          },
          required: ["score"],
          additionalProperties: false,
        },
      };

      const task = await prisma.task.create({
        data: {
          nodeId: node.id,
          name: "Structured Task",
          evidenceRequired: true,
          evidenceSchema: schema as any,
        },
      });

      const snapshot: WorkflowSnapshot = {
        workflowId: workflow.id,
        version: 1,
        name: workflow.name,
        description: null,
        isNonTerminating: false,
        nodes: [
          {
            id: node.id,
            name: node.name,
            isEntry: true,
            nodeKind: "MAINLINE",
            completionRule: CompletionRule.ALL_TASKS_DONE,
            specificTasks: [],
            tasks: [
              {
                id: task.id,
                name: task.name,
                instructions: null,
                evidenceRequired: true,
                evidenceSchema: schema as any,
                displayOrder: 0,
                outcomes: [{ id: "o1", name: "DONE" }],
              },
            ],
            transitiveSuccessors: [],
          },
        ],
        gates: [{ id: "g1", sourceNodeId: node.id, outcomeName: "DONE", targetNodeId: null }],
      };

      const workflowVersion = await prisma.workflowVersion.create({
        data: { workflowId: workflow.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
      });

      const flowGroup = await prisma.flowGroup.create({
        data: { scopeType: "test", scopeId: "test-2", companyId: company.id },
      });

      const flow = await prisma.flow.create({
        data: {
          workflow: { connect: { id: workflow.id } },
          workflowVersion: { connect: { id: workflowVersion.id } },
          flowGroup: { connect: { id: flowGroup.id } },
        },
      });

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "test-user");

      // Valid structured evidence
      const result = await attachEvidence(
        flow.id,
        task.id,
        EvidenceType.STRUCTURED,
        { content: { score: 10, comment: "Looks good" } },
        "test-user"
      );
      expect(result.evidenceAttachment).toBeDefined();
    });

    it("should fail validation for missing required property", async () => {
      const company = await createTestCompany();
      const node = await prisma.node.create({
        data: {
          workflow: { create: { name: "W1", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 } },
          name: "N1",
          isEntry: true,
        },
      });
      const workflow = await prisma.workflow.findFirst({ where: { companyId: company.id } });

      const schema = {
        type: "structured",
        jsonSchema: {
          type: "object",
          properties: { score: { type: "number" } },
          required: ["score"],
        },
      };

      const task = await prisma.task.create({
        data: { nodeId: node.id, name: "T1", evidenceRequired: true, evidenceSchema: schema as any },
      });

      const snapshot: any = { nodes: [{ id: node.id, tasks: [{ id: task.id, evidenceSchema: schema }] }] };
      const workflowVersion = await prisma.workflowVersion.create({
        data: { workflowId: workflow!.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
      });

      const flow = await prisma.flow.create({
        data: {
          workflow: { connect: { id: workflow!.id } },
          workflowVersion: { connect: { id: workflowVersion.id } },
          flowGroup: { create: { scopeType: "t", scopeId: "s", companyId: company.id } },
        },
      });

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "u1");

      const result = await attachEvidence(flow.id, task.id, EvidenceType.STRUCTURED, { content: { comment: "no score" } }, "u1");
      expect(result.error?.code).toBe("INVALID_EVIDENCE_FORMAT");
      expect(result.error?.message).toContain("must have required property 'score'");
    });

    it("should fail validation for additional properties when not allowed", async () => {
      const company = await createTestCompany();
      const node = await prisma.node.create({
        data: {
          workflow: { create: { name: "W1", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 } },
          name: "N1",
          isEntry: true,
        },
      });
      const workflow = await prisma.workflow.findFirst({ where: { companyId: company.id } });

      const schema = {
        type: "structured",
        jsonSchema: {
          type: "object",
          properties: { score: { type: "number" } },
          additionalProperties: false,
        },
      };

      const task = await prisma.task.create({
        data: { nodeId: node.id, name: "T1", evidenceRequired: true, evidenceSchema: schema as any },
      });

      const snapshot: any = { nodes: [{ id: node.id, tasks: [{ id: task.id, evidenceSchema: schema }] }] };
      const workflowVersion = await prisma.workflowVersion.create({
        data: { workflowId: workflow!.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
      });

      const flow = await prisma.flow.create({
        data: {
          workflow: { connect: { id: workflow!.id } },
          workflowVersion: { connect: { id: workflowVersion.id } },
          flowGroup: { create: { scopeType: "t", scopeId: "s", companyId: company.id } },
        },
      });

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "u1");

      const result = await attachEvidence(flow.id, task.id, EvidenceType.STRUCTURED, { content: { score: 10, extra: "not allowed" } }, "u1");
      expect(result.error?.code).toBe("INVALID_EVIDENCE_FORMAT");
      expect(result.error?.message).toContain("must NOT have additional properties");
    });

    it("should fail for unsupported JSON Schema keywords", async () => {
      const company = await createTestCompany();
      const node = await prisma.node.create({
        data: {
          workflow: { create: { name: "W1", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 } },
          name: "N1",
          isEntry: true,
        },
      });
      const workflow = await prisma.workflow.findFirst({ where: { companyId: company.id } });

      const schema = {
        type: "structured",
        jsonSchema: {
          type: "object",
          oneOf: [{ properties: { a: { type: "string" } } }], // oneOf is not supported
        },
      };

      const task = await prisma.task.create({
        data: { nodeId: node.id, name: "T1", evidenceRequired: true, evidenceSchema: schema as any },
      });

      const snapshot: any = { nodes: [{ id: node.id, tasks: [{ id: task.id, evidenceSchema: schema }] }] };
      const workflowVersion = await prisma.workflowVersion.create({
        data: { workflowId: workflow!.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
      });

      const flow = await prisma.flow.create({
        data: {
          workflow: { connect: { id: workflow!.id } },
          workflowVersion: { connect: { id: workflowVersion.id } },
          flowGroup: { create: { scopeType: "t", scopeId: "s", companyId: company.id } },
        },
      });

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "u1");

      const result = await attachEvidence(flow.id, task.id, EvidenceType.STRUCTURED, { content: { a: "test" } }, "u1");
      expect(result.error?.code).toBe("INVALID_EVIDENCE_FORMAT");
      expect(result.error?.message).toContain("Unsupported JSON Schema keyword: oneOf");
    });

    it("should fail-closed if jsonSchema is missing", async () => {
      const company = await createTestCompany();
      const node = await prisma.node.create({
        data: {
          workflow: { create: { name: "W1", companyId: company.id, status: WorkflowStatus.PUBLISHED, version: 1 } },
          name: "N1",
          isEntry: true,
        },
      });
      const workflow = await prisma.workflow.findFirst({ where: { companyId: company.id } });

      const schema = {
        type: "structured",
        // missing jsonSchema
      };

      const task = await prisma.task.create({
        data: { nodeId: node.id, name: "T1", evidenceRequired: true, evidenceSchema: schema as any },
      });

      const snapshot: any = { nodes: [{ id: node.id, tasks: [{ id: task.id, evidenceSchema: schema }] }] };
      const workflowVersion = await prisma.workflowVersion.create({
        data: { workflowId: workflow!.id, version: 1, snapshot: snapshot as any, publishedBy: "test" },
      });

      const flow = await prisma.flow.create({
        data: {
          workflow: { connect: { id: workflow!.id } },
          workflowVersion: { connect: { id: workflowVersion.id } },
          flowGroup: { create: { scopeType: "t", scopeId: "s", companyId: company.id } },
        },
      });

      await activateEntryNodes(flow.id, snapshot);
      await startTask(flow.id, task.id, "u1");

      const result = await attachEvidence(flow.id, task.id, EvidenceType.STRUCTURED, { content: { a: "test" } }, "u1");
      expect(result.error?.code).toBe("INVALID_EVIDENCE_FORMAT");
      expect(result.error?.message).toBe("Structured evidence requires a jsonSchema for validation");
    });
  });
});
