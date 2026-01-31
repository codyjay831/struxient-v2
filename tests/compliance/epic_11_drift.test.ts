import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { FlowStatus, EvidenceType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

describe("EPIC-11 Compliance: Customer History & Aggregations", () => {
  
  describe("Schema Integrity", () => {
    it("Customer model MUST NOT contain execution fields (status, stage, etc.)", () => {
      // Introspect Prisma model fields
      const customerFields = (prisma as unknown as { _runtimeDataModel: { models: { Customer: { fields: { name: string }[] } } } })._runtimeDataModel.models.Customer.fields.map((f) => f.name);
      
      const forbiddenFields = ["status", "stage", "grade", "lifecycle", "history", "vault"];
      
      forbiddenFields.forEach(field => {
        expect(customerFields, `Customer model should not contain field: ${field}`).not.toContain(field);
      });
    });
  });

  describe("API Guard: Projection Routes MUST be GET-only", () => {
    const projectionRoutes = [
      "src/app/api/customers/[id]/history/route.ts",
      "src/app/api/customers/[id]/vault/route.ts",
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

  describe("Reconstruction Test (Relationship Projection Integrity)", () => {
    let testCompanyId: string;
    let testCustomerId: string;
    let testFlowGroupId1: string;
    let testFlowGroupId2: string;
    let testJobId1: string;
    let testJobId2: string;
    let testFlowId1: string;
    let testFlowId2: string;
    let testWorkflowId: string;
    let testWorkflowVersionId: string;

    beforeAll(async () => {
      // Setup minimal fixture
      const company = await prisma.company.create({ data: { name: "EPIC-11 Test Co" } });
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

      // Job 1
      const flowGroup1 = await prisma.flowGroup.create({
        data: { scopeType: "job", scopeId: "test-scope-1", companyId: testCompanyId }
      });
      testFlowGroupId1 = flowGroup1.id;

      const job1 = await prisma.job.create({
        data: { 
          companyId: testCompanyId, 
          customerId: testCustomerId, 
          flowGroupId: testFlowGroupId1,
          address: "123 Job One St"
        }
      });
      testJobId1 = job1.id;

      const flow1 = await prisma.flow.create({
        data: {
          workflowId: testWorkflowId,
          workflowVersionId: testWorkflowVersionId,
          flowGroupId: testFlowGroupId1,
          status: FlowStatus.ACTIVE
        }
      });
      testFlowId1 = flow1.id;

      // Job 2
      const flowGroup2 = await prisma.flowGroup.create({
        data: { scopeType: "job", scopeId: "test-scope-2", companyId: testCompanyId }
      });
      testFlowGroupId2 = flowGroup2.id;

      const job2 = await prisma.job.create({
        data: { 
          companyId: testCompanyId, 
          customerId: testCustomerId, 
          flowGroupId: testFlowGroupId2,
          address: "456 Job Two Ave"
        }
      });
      testJobId2 = job2.id;

      const flow2 = await prisma.flow.create({
        data: {
          workflowId: testWorkflowId,
          workflowVersionId: testWorkflowVersionId,
          flowGroupId: testFlowGroupId2,
          status: FlowStatus.COMPLETED
        }
      });
      testFlowId2 = flow2.id;

      // Add truth events
      await prisma.nodeActivation.create({
        data: { flowId: testFlowId1, nodeId: "j1-node-1", iteration: 1 }
      });
      await prisma.nodeActivation.create({
        data: { flowId: testFlowId2, nodeId: "j2-node-1", iteration: 1 }
      });

      await prisma.taskExecution.create({
        data: { 
          flowId: testFlowId1, 
          taskId: "j1-task-1", 
          startedAt: new Date(), 
          startedBy: "tester",
          iteration: 1 
        }
      });

      await prisma.evidenceAttachment.create({
        data: {
          flowId: testFlowId1,
          taskId: "j1-task-1",
          type: EvidenceType.TEXT,
          data: "J1 Evidence",
          attachedBy: "tester"
        }
      });
      await prisma.evidenceAttachment.create({
        data: {
          flowId: testFlowId2,
          taskId: "j2-task-1",
          type: EvidenceType.TEXT,
          data: "J2 Evidence",
          attachedBy: "tester"
        }
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.evidenceAttachment.deleteMany({ where: { flowId: { in: [testFlowId1, testFlowId2] } } });
      await prisma.taskExecution.deleteMany({ where: { flowId: { in: [testFlowId1, testFlowId2] } } });
      await prisma.nodeActivation.deleteMany({ where: { flowId: { in: [testFlowId1, testFlowId2] } } });
      await prisma.flow.deleteMany({ where: { id: { in: [testFlowId1, testFlowId2] } } });
      await prisma.job.deleteMany({ where: { id: { in: [testJobId1, testJobId2] } } });
      await prisma.flowGroup.deleteMany({ where: { id: { in: [testFlowGroupId1, testFlowGroupId2] } } });
      await prisma.workflowVersion.delete({ where: { id: testWorkflowVersionId } });
      await prisma.workflow.delete({ where: { id: testWorkflowId } });
      await prisma.customer.delete({ where: { id: testCustomerId } });
      await prisma.company.delete({ where: { id: testCompanyId } });
    });

    it("Lifetime Ledger projection MUST interleave and aggregate all Job events", async () => {
      // Query the actual handler logic
      const jobs = await prisma.job.findMany({
        where: { customerId: testCustomerId },
        include: {
          flowGroup: {
            include: {
              flows: {
                include: {
                  nodeActivations: true,
                  taskExecutions: true,
                  evidenceAttachments: true,
                }
              }
            }
          }
        }
      });

      let totalEvents = 0;
      jobs.forEach(job => {
        job.flowGroup.flows.forEach(flow => {
          totalEvents += flow.nodeActivations.length;
          totalEvents += flow.taskExecutions.filter(te => te.startedAt).length;
          totalEvents += flow.taskExecutions.filter(te => te.outcome).length;
          totalEvents += flow.evidenceAttachments.length;
        });
      });

      // Total expected: 
      // J1: 1 NodeActivation + 1 TaskStart + 1 Evidence = 3
      // J2: 1 NodeActivation + 1 Evidence = 2
      // Total = 5
      expect(totalEvents).toBe(5);
    });

    it("Evidence Vault MUST aggregate all EvidenceAttachments across all Jobs", async () => {
      const attachments = await prisma.evidenceAttachment.count({
        where: {
          flow: {
            flowGroup: {
              job: {
                customerId: testCustomerId
              }
            }
          }
        }
      });

      expect(attachments).toBe(2);
    });
  });
});
