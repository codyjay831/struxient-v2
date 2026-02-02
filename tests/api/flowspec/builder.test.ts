/**
 * FlowSpec Builder API Tests
 *
 * Epic: EPIC-07 FlowSpec Builder API
 * Canon Source: 50_flowspec_builder_ui_api_map.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as workflowRoute from "@/app/api/flowspec/workflows/route";
import * as singleWorkflowRoute from "@/app/api/flowspec/workflows/[id]/route";
import { WorkflowStatus } from "@prisma/client";
import { apiSuccess, apiList } from "@/lib/api-utils";
import { type AuthorityContext } from "@/lib/auth/capabilities";

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

describe("EPIC-07: FlowSpec Builder API", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("Workflow API", () => {
    it("should list workflows for the current tenant", async () => {
      const company = await createTestCompany();
      await createTestMember(company.id, MOCK_USER_ID);
      
      // Mock Clerk session
      (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

      // Create some workflows
      await prisma.workflow.create({
        data: { name: "W1", companyId: company.id }
      });
      await prisma.workflow.create({
        data: { name: "W2", companyId: company.id }
      });

      const req = new NextRequest("http://localhost/api/flowspec/workflows");
      const res = await workflowRoute.GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items.length).toBe(2);
      expect(data.pagination.total).toBe(2);
    });

    it("should create a new workflow", async () => {
      const company = await createTestCompany();
      await createTestMember(company.id, MOCK_USER_ID);
      (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

      const req = new NextRequest("http://localhost/api/flowspec/workflows", {
        method: "POST",
        body: JSON.stringify({ name: "New Workflow", description: "Test" }),
      });

      const res = await workflowRoute.POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.workflow.name).toBe("New Workflow");
      expect(data.workflow.companyId).toBe(company.id);
    });

    it("should get a specific workflow", async () => {
      const company = await createTestCompany();
      await createTestMember(company.id, MOCK_USER_ID);
      (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

      const wf = await prisma.workflow.create({
        data: { name: "Specific Wf", companyId: company.id }
      });

      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${wf.id}`);
      const res = await singleWorkflowRoute.GET(req, { params: Promise.resolve({ id: wf.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workflow.id).toBe(wf.id);
    });

    it("should reject update on Published workflow (INV-011)", async () => {
      const company = await createTestCompany();
      await createTestMember(company.id, MOCK_USER_ID);
      (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

      const wf = await prisma.workflow.create({
        data: { 
          name: "Published Wf", 
          companyId: company.id,
          status: WorkflowStatus.PUBLISHED
        }
      });

      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${wf.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Attempted Rename" }),
      });

      const res = await singleWorkflowRoute.PATCH(req, { params: Promise.resolve({ id: wf.id }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error.code).toBe("PUBLISHED_IMMUTABLE");
    });

    it("should auto-revert VALIDATED workflow to DRAFT on update (INV-026 Policy B)", async () => {
      const company = await createTestCompany();
      await createTestMember(company.id, MOCK_USER_ID);
      (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

      const wf = await prisma.workflow.create({
        data: { 
          name: "Validated Wf", 
          companyId: company.id,
          status: WorkflowStatus.VALIDATED
        }
      });

      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${wf.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Auto-Reverted Rename" }),
      });

      const res = await singleWorkflowRoute.PATCH(req, { params: Promise.resolve({ id: wf.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.workflow.name).toBe("Auto-Reverted Rename");
      
      const updated = await prisma.workflow.findUnique({ where: { id: wf.id } });
      expect(updated?.status).toBe(WorkflowStatus.DRAFT);
    });

    it("should reject cross-tenant access", async () => {
      const company1 = await createTestCompany("C1");
      const company2 = await createTestCompany("C2");
      await createTestMember(company1.id, MOCK_USER_ID);
      // User is NOT a member of company2
      
      (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

      const wf = await prisma.workflow.create({
        data: { name: "Wf in C2", companyId: company2.id }
      });

      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${wf.id}`);
      const res = await singleWorkflowRoute.GET(req, { params: Promise.resolve({ id: wf.id }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error.code).toBe("NO_MEMBERSHIP");
    });
  });

  describe("api-utils: Data Shaping", () => {
    const ctxNoCost: AuthorityContext = {
      role: "WORKER",
      capabilities: { allow: [], deny: [] },
    };

    const sampleData = {
      id: "1",
      name: "Test",
      cost: 1000,
      nested: {
        margin: 0.5,
        other: "value"
      }
    };

    it("apiSuccess should null cost fields if authority context is provided", async () => {
      const res = apiSuccess(sampleData, 200, ctxNoCost);
      const data = await res.json();

      expect(data.id).toBe("1");
      expect(data.cost).toBeNull();
      expect(data.nested.margin).toBeNull();
      expect(data.nested.other).toBe("value");
    });

    it("apiList should null cost fields in items if authority context is provided", async () => {
      const res = apiList([sampleData], 1, 0, 10, ctxNoCost);
      const data = await res.json();

      expect(data.items[0].cost).toBeNull();
      expect(data.items[0].nested.margin).toBeNull();
    });
  });
});
