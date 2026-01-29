/**
 * FlowSpec Gate Status Enforcement Tests
 *
 * Proves:
 * - POST/PATCH/DELETE gates succeed in DRAFT
 * - POST/PATCH/DELETE gates fail (403) in VALIDATED and PUBLISHED
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as gateRoute from "@/app/api/flowspec/workflows/[id]/gates/route";
import * as singleGateRoute from "@/app/api/flowspec/workflows/[id]/gates/[gateId]/route";
import { WorkflowStatus } from "@prisma/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function cleanupTestData() {
  await prisma.gate.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Gate Status Enforcement", () => {
  const MOCK_USER_ID = "user_123";
  let companyId: string;
  let workflowId: string;
  let nodeId: string;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    await prisma.companyMember.create({
      data: { companyId, userId: MOCK_USER_ID, role: "OWNER" },
    });

    const wf = await prisma.workflow.create({
      data: { name: "Test Wf", companyId, status: WorkflowStatus.DRAFT },
    });
    workflowId = wf.id;

    const node = await prisma.node.create({
      data: { workflowId, name: "N1" },
    });
    nodeId = node.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  const statuses = [WorkflowStatus.VALIDATED, WorkflowStatus.PUBLISHED];

  describe("POST /api/flowspec/workflows/[id]/gates", () => {
    it("should succeed in DRAFT status", async () => {
      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowId}/gates`, {
        method: "POST",
        body: JSON.stringify({
          sourceNodeId: nodeId,
          outcomeName: "OK",
          targetNodeId: null,
        }),
      });

      const res = await gateRoute.POST(req, { params: Promise.resolve({ id: workflowId }) });
      expect(res.status).toBe(201);
    });

    statuses.forEach((status) => {
      it(`should fail in ${status} status`, async () => {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: { status },
        });

        const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowId}/gates`, {
          method: "POST",
          body: JSON.stringify({
            sourceNodeId: nodeId,
            outcomeName: "OK",
            targetNodeId: null,
          }),
        });

        const res = await gateRoute.POST(req, { params: Promise.resolve({ id: workflowId }) });
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error.code).toBe("WORKFLOW_NOT_EDITABLE");
      });
    });
  });

  describe("PATCH /api/flowspec/workflows/[id]/gates/[gateId]", () => {
    let gateId: string;

    beforeEach(async () => {
      const gate = await prisma.gate.create({
        data: { workflowId, sourceNodeId: nodeId, outcomeName: "OK", targetNodeId: null },
      });
      gateId = gate.id;
    });

    it("should succeed in DRAFT status", async () => {
      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowId}/gates/${gateId}`, {
        method: "PATCH",
        body: JSON.stringify({ targetNodeId: nodeId }),
      });

      const res = await singleGateRoute.PATCH(req, { params: Promise.resolve({ id: workflowId, gateId }) });
      expect(res.status).toBe(200);
    });

    statuses.forEach((status) => {
      it(`should fail in ${status} status`, async () => {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: { status },
        });

        const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowId}/gates/${gateId}`, {
          method: "PATCH",
          body: JSON.stringify({ targetNodeId: nodeId }),
        });

        const res = await singleGateRoute.PATCH(req, { params: Promise.resolve({ id: workflowId, gateId }) });
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error.code).toBe("WORKFLOW_NOT_EDITABLE");
      });
    });
  });

  describe("DELETE /api/flowspec/workflows/[id]/gates/[gateId]", () => {
    let gateId: string;

    beforeEach(async () => {
      const gate = await prisma.gate.create({
        data: { workflowId, sourceNodeId: nodeId, outcomeName: "OK", targetNodeId: null },
      });
      gateId = gate.id;
    });

    it("should succeed in DRAFT status", async () => {
      const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowId}/gates/${gateId}`, {
        method: "DELETE",
      });

      const res = await singleGateRoute.DELETE(req, { params: Promise.resolve({ id: workflowId, gateId }) });
      expect(res.status).toBe(200);
    });

    statuses.forEach((status) => {
      it(`should fail in ${status} status`, async () => {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: { status },
        });

        const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowId}/gates/${gateId}`, {
          method: "DELETE",
        });

        const res = await singleGateRoute.DELETE(req, { params: Promise.resolve({ id: workflowId, gateId }) });
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error.code).toBe("WORKFLOW_NOT_EDITABLE");
      });
    });
  });
});
