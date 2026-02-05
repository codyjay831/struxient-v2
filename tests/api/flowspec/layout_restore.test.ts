/**
 * Layout Restore API Hardening Test
 * 
 * Verifies that the layout/restore endpoint:
 * 1. Enforces tenant isolation.
 * 2. Only updates nodes that belong to the specified workflow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as layoutRestoreRoute from "@/app/api/flowspec/workflows/[id]/layout/restore/route";
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
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Layout Restore API: Hardening", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should only update nodes belonging to the target workflow", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Create Workflow A and Node A
    const workflowA = await prisma.workflow.create({
      data: {
        name: "Workflow A",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });
    const nodeA = await prisma.node.create({
      data: {
        workflowId: workflowA.id,
        name: "Node A",
        position: { x: 0, y: 0 },
      },
    });

    // 2. Create Workflow B and Node B
    const workflowB = await prisma.workflow.create({
      data: {
        name: "Workflow B",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });
    const nodeB = await prisma.node.create({
      data: {
        workflowId: workflowB.id,
        name: "Node B",
        position: { x: 0, y: 0 },
      },
    });

    // 3. Attempt to restore layout for Workflow A, but include Node B in payload
    const payload = {
      positions: {
        [nodeA.id]: { x: 100, y: 100 },
        [nodeB.id]: { x: 200, y: 200 }, // MALICIOUS/ERRONEOUS: belongs to workflow B
      }
    };

    const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflowA.id}/layout/restore`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await layoutRestoreRoute.POST(req, { params: Promise.resolve({ id: workflowA.id }) });
    expect(res.status).toBe(200);

    // 4. Verify results
    const updatedNodeA = await prisma.node.findUnique({ where: { id: nodeA.id } });
    const updatedNodeB = await prisma.node.findUnique({ where: { id: nodeB.id } });

    // Node A should be updated
    expect((updatedNodeA?.position as any).x).toBe(100);
    
    // Node B should NOT be updated because it belongs to Workflow B
    expect((updatedNodeB?.position as any).x).toBe(0);
  });

  it("should enforce tenant isolation (forbidden if workflow belongs to another company)", async () => {
    // 1. Setup Company 1 (Victim) and Workflow
    const victimCompany = await createTestCompany("Victim Company");
    const victimWorkflow = await prisma.workflow.create({
      data: {
        name: "Victim Workflow",
        companyId: victimCompany.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    // 2. Setup Company 2 (Attacker) and User
    const attackerCompany = await createTestCompany("Attacker Company");
    await createTestMember(attackerCompany.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 3. Attacker tries to restore layout for Victim's workflow
    const req = new NextRequest(`http://localhost/api/flowspec/workflows/${victimWorkflow.id}/layout/restore`, {
      method: "POST",
      body: JSON.stringify({ positions: {} }),
    });

    const res = await layoutRestoreRoute.POST(req, { params: Promise.resolve({ id: victimWorkflow.id }) });
    
    // Should be 403 Forbidden or similar (tenant error response)
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(["FORBIDDEN", "NO_MEMBERSHIP"]).toContain(data.error.code);
  });
});
