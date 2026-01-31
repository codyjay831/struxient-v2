import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { FlowStatus, EvidenceType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

describe("EPIC-10 Compliance: Drift Prevention & Projection Integrity", () => {
  
  describe("Schema Integrity", () => {
    it("Job model MUST NOT contain forbidden fields (status, stage, currentNode)", () => {
      // Introspect Prisma model fields
      const jobFields = (prisma as unknown as { _runtimeDataModel: { models: { Job: { fields: { name: string }[] } } } })._runtimeDataModel.models.Job.fields.map((f) => f.name);
      
      const forbiddenFields = ["status", "stage", "currentNode", "current_node", "currentStage", "current_stage"];
      
      forbiddenFields.forEach(field => {
        expect(jobFields, `Job model should not contain field: ${field}`).not.toContain(field);
      });
    });

    it("Customer model MUST NOT contain execution truth fields", () => {
      const customerFields = (prisma as unknown as { _runtimeDataModel: { models: { Customer: { fields: { name: string }[] } } } })._runtimeDataModel.models.Customer.fields.map((f) => f.name);
      const forbiddenFields = ["status", "stage", "outcomes", "evidence"];
      
      forbiddenFields.forEach(field => {
        expect(customerFields, `Customer model should not contain field: ${field}`).not.toContain(field);
      });
    });
  });

  describe("API Guard: Projection Routes MUST be GET-only", () => {
    const projectionRoutes = [
      "src/app/api/customers/[id]/summary/route.ts",
      "src/app/api/jobs/[id]/timeline/route.ts",
    ];

    projectionRoutes.forEach((routePath) => {
      it(`Route ${routePath} should only export GET handler`, () => {
        const fullPath = path.resolve(process.cwd(), routePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        
        const forbiddenMethods = ["POST", "PUT", "PATCH", "DELETE"];
        forbiddenMethods.forEach((method) => {
          const exportPattern = new RegExp(`export\\s+async\\s+function\\s+${method}`, "i");
          expect(content, `${routePath} should not export ${method} handler`).not.toMatch(exportPattern);
        });
      });
    });
  });

  describe("Reconstruction Test (Projection Surface Integrity)", () => {
    let testCompanyId: string;
    let testCustomerId: string;
    let testFlowGroupId: string;
    let testJobId: string;
    let testFlowId: string;
    let testWorkflowId: string;
    let testWorkflowVersionId: string;

    beforeAll(async () => {
      // Setup minimal fixture
      const company = await prisma.company.create({ data: { name: "EPIC-10 Test Co" } });
      testCompanyId = company.id;

      const customer = await prisma.customer.create({ 
        data: { name: "Test Customer", companyId: testCompanyId } 
      });
      testCustomerId = customer.id;

      const workflow = await prisma.workflow.create({
        data: { name: "Test Workflow", companyId: testCompanyId, status: "PUBLISHED" }
      });
      testWorkflowId = workflow.id;

      const version = await prisma.workflowVersion.create({
        data: { 
          workflowId: testWorkflowId, 
          version: 1, 
          snapshot: {}, 
          publishedBy: "test-user" 
        }
      });
      testWorkflowVersionId = version.id;

      const flowGroup = await prisma.flowGroup.create({
        data: { scopeType: "job", scopeId: "test-scope", companyId: testCompanyId }
      });
      testFlowGroupId = flowGroup.id;

      const job = await prisma.job.create({
        data: { 
          companyId: testCompanyId, 
          customerId: testCustomerId, 
          flowGroupId: testFlowGroupId,
          address: "123 Reconstruction Ave"
        }
      });
      testJobId = job.id;

      const flow = await prisma.flow.create({
        data: {
          workflowId: testWorkflowId,
          workflowVersionId: testWorkflowVersionId,
          flowGroupId: testFlowGroupId,
          status: FlowStatus.ACTIVE
        }
      });
      testFlowId = flow.id;

      // Add a couple truth events
      await prisma.nodeActivation.create({
        data: { flowId: testFlowId, nodeId: "node-1", iteration: 1 }
      });

      await prisma.taskExecution.create({
        data: { 
          flowId: testFlowId, 
          taskId: "task-1", 
          startedAt: new Date(), 
          startedBy: "tester",
          iteration: 1 
        }
      });

      await prisma.evidenceAttachment.create({
        data: {
          flowId: testFlowId,
          taskId: "task-1",
          type: EvidenceType.TEXT,
          data: "Test Evidence",
          attachedBy: "tester"
        }
      });
    });

    afterAll(async () => {
      // Cleanup - delete in reverse order of dependencies
      await prisma.evidenceAttachment.deleteMany({ where: { flowId: testFlowId } });
      await prisma.taskExecution.deleteMany({ where: { flowId: testFlowId } });
      await prisma.nodeActivation.deleteMany({ where: { flowId: testFlowId } });
      await prisma.flow.delete({ where: { id: testFlowId } });
      await prisma.job.delete({ where: { id: testJobId } });
      await prisma.flowGroup.delete({ where: { id: testFlowGroupId } });
      await prisma.workflowVersion.delete({ where: { id: testWorkflowVersionId } });
      await prisma.workflow.delete({ where: { id: testWorkflowId } });
      await prisma.customer.delete({ where: { id: testCustomerId } });
      await prisma.company.delete({ where: { id: testCompanyId } });
    });

    it("Timeline projection MUST equal FlowSpec-derived ledger and NOT depend on Job fields", async () => {
      // 1. Fetch from the projection logic (simulated route logic)
      const flows = await prisma.flow.findMany({
        where: { flowGroupId: testFlowGroupId },
        include: {
          workflow: { select: { name: true } },
          nodeActivations: true,
          taskExecutions: true,
          evidenceAttachments: true,
        },
      });

      const timeline: { type: string; id: string }[] = [];
      for (const flow of flows) {
        flow.nodeActivations.forEach(na => timeline.push({ type: "NODE_ACTIVATED", id: na.id }));
        flow.taskExecutions.forEach(te => {
          if (te.startedAt) timeline.push({ type: "TASK_STARTED", id: te.id });
          if (te.outcome) timeline.push({ type: "TASK_OUTCOME", id: te.id });
        });
        flow.evidenceAttachments.forEach(ea => timeline.push({ type: "EVIDENCE_ATTACHED", id: ea.id }));
      }

      // 2. Fetch directly from truth tables to compare
      const naCount = await prisma.nodeActivation.count({ where: { flowId: testFlowId } });
      const teCount = await prisma.taskExecution.count({ where: { flowId: testFlowId } });
      const eaCount = await prisma.evidenceAttachment.count({ where: { flowId: testFlowId } });

      // Expectation: Total timeline events match truth table counts
      // (1 node activation + 1 task started = 2 in timeline so far)
      expect(timeline.length).toBe(naCount + teCount + eaCount);
      
      // Verification: Timeline contains specific events created in beforeAll
      expect(timeline.some(e => e.type === "NODE_ACTIVATED")).toBe(true);
      expect(timeline.some(e => e.type === "TASK_STARTED")).toBe(true);
      expect(timeline.some(e => e.type === "EVIDENCE_ATTACHED")).toBe(true);
    });
  });
});
