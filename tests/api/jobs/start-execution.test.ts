import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as startExecutionRoute from "@/app/api/jobs/start-execution/route";
import { auth } from "@clerk/nextjs/server";
import { WorkflowStatus } from "@prisma/client";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

const COMPANY_ID = "test-company";
const USER_ID = "test-user";

async function cleanupTestData() {
  await prisma.job.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("P0-1: start-execution Address Validation", () => {
  let customerId: string;
  let workflowId: string;

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();

    // Setup
    await prisma.company.create({ data: { id: COMPANY_ID, name: "Test Co" } });
    await prisma.companyMember.create({
      data: { companyId: COMPANY_ID, userId: USER_ID, role: "OWNER" },
    });
    
    const customer = await prisma.customer.create({
      data: { companyId: COMPANY_ID, name: "Test Customer" },
    });
    customerId = customer.id;

    const workflow = await prisma.workflow.create({
      data: {
        companyId: COMPANY_ID,
        name: "Test Workflow",
        status: WorkflowStatus.PUBLISHED,
      },
    });
    workflowId = workflow.id;

    const snapshot = {
      workflowId,
      version: 1,
      name: "Test Workflow",
      nodes: [
        {
          id: "n1",
          name: "Entry Node",
          isEntry: true,
          tasks: [
            {
              id: "t1",
              name: "Anchor Task",
              displayOrder: 1,
              evidenceRequired: true,
              evidenceSchema: { type: "structured" },
              outcomes: [{ id: "o1", name: "DONE" }],
            }
          ]
        }
      ],
      gates: []
    };

    await prisma.workflowVersion.create({
      data: {
        workflowId,
        version: 1,
        snapshot: snapshot as any,
        publishedBy: USER_ID,
      },
    });

    (auth as any).mockResolvedValue({ userId: USER_ID });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should succeed with a provided address", async () => {
    const req = new NextRequest("http://localhost/api/jobs/start-execution", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        workflowIds: [workflowId],
        address: "123 Valid St"
      }),
    });

    const res = await startExecutionRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.job.address).toBe("123 Valid St");
  });

  it("should succeed with NO address (optional validation fix)", async () => {
    const req = new NextRequest("http://localhost/api/jobs/start-execution", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        workflowIds: [workflowId]
        // address omitted
      }),
    });

    const res = await startExecutionRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.job.address).toBe(null);
  });

  it("should fail if customerId is missing", async () => {
    const req = new NextRequest("http://localhost/api/jobs/start-execution", {
      method: "POST",
      body: JSON.stringify({
        workflowIds: [workflowId],
        address: "123 St"
      }),
    });

    const res = await startExecutionRoute.POST(req);
    expect(res.status).toBe(400);
  });

  it("should fail if workflowIds is missing or empty", async () => {
    const req = new NextRequest("http://localhost/api/jobs/start-execution", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        workflowIds: [],
        address: "123 St"
      }),
    });

    const res = await startExecutionRoute.POST(req);
    expect(res.status).toBe(400);
  });
});
