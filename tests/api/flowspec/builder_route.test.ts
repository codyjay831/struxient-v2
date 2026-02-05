/**
 * Builder Route Merge Regression Test
 * 
 * Simulates an incomplete buffer and ensures all relational nodes still render.
 * Requirement: UNION of nodes (Truth + Buffer).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as builderRoute from "@/app/api/flowspec/workflows/[id]/builder/route";
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
  await prisma.workflowDraftBuffer.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Builder Route: Node Merge Hardening", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return union of relational nodes and buffered nodes", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // 1. Create workflow with 2 relational nodes
    const workflow = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    const node1 = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: "Relational Node 1",
        position: { x: 100, y: 100 },
      },
    });

    const node2 = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: "Relational Node 2",
        position: { x: 200, y: 200 },
      },
    });

    // 2. Create buffer that is MISSING node2, and has a NEW node3
    // and UPDATES node1
    const bufferContent = {
      nodes: [
        {
          id: node1.id,
          name: "Updated Node 1",
          position: { x: 999, y: 999 }, // This should be ignored in favor of truth
        },
        {
          id: "new-node-id",
          name: "New Node 3",
          position: { x: 300, y: 300 },
        },
      ],
    };

    await prisma.workflowDraftBuffer.create({
      data: {
        companyId: company.id,
        workflowId: workflow.id,
        content: bufferContent,
        updatedBy: MOCK_USER_ID,
      },
    });

    const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflow.id}/builder`);
    const res = await builderRoute.GET(req, { params: Promise.resolve({ id: workflow.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    const nodes = data.workflow.nodes;

    // Requirement: UNION of nodes
    expect(nodes.length).toBe(3);

    // Relational node 1: Overlaid with buffer
    const mergedNode1 = nodes.find((n: any) => n.id === node1.id);
    expect(mergedNode1).toBeDefined();
    expect(mergedNode1.name).toBe("Updated Node 1");
    // Position rule: Truth when valid
    expect(mergedNode1.position.x).toBe(100);

    // Relational node 2: Missing from buffer but MUST appear
    const mergedNode2 = nodes.find((n: any) => n.id === node2.id);
    expect(mergedNode2).toBeDefined();
    expect(mergedNode2.name).toBe("Relational Node 2");
    expect(mergedNode2.position.x).toBe(200);

    // Buffered node 3: New node
    const mergedNode3 = nodes.find((n: any) => n.id === "new-node-id");
    expect(mergedNode3).toBeDefined();
    expect(mergedNode3.name).toBe("New Node 3");
    expect(mergedNode3.position.x).toBe(300);
  });

  it("should fall back to buffer position if relational position is missing", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const workflow = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        companyId: company.id,
        status: WorkflowStatus.DRAFT,
      },
    });

    const node1 = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: "Relational Node 1",
      },
    });

    const bufferContent = {
      nodes: [
        {
          id: node1.id,
          name: "Node 1",
          position: { x: 500, y: 500 }, // Provided in buffer
        },
      ],
    };

    await prisma.workflowDraftBuffer.create({
      data: {
        companyId: company.id,
        workflowId: workflow.id,
        content: bufferContent,
        updatedBy: MOCK_USER_ID,
      },
    });

    const req = new NextRequest(`http://localhost/api/flowspec/workflows/${workflow.id}/builder`);
    const res = await builderRoute.GET(req, { params: Promise.resolve({ id: workflow.id }) });
    const data = await res.json();

    const mergedNode1 = data.workflow.nodes[0];
    expect(mergedNode1.position.x).toBe(500);
  });
});
