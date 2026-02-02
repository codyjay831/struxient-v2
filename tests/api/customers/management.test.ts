import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as customerRoute from "@/app/api/customers/route";
import { auth } from "@clerk/nextjs/server";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

async function createTestCompany(name: string) {
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
  await prisma.jobAssignment.deleteMany({});
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

describe("Customer Management API Tests", () => {
  const USER_A = "user_tenant_a";
  const USER_B = "user_tenant_b";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should create customer for the actor's company", async () => {
    const companyA = await createTestCompany("Company A");
    await createTestMember(companyA.id, USER_A);

    (auth as any).mockResolvedValue({ userId: USER_A });
    
    const req = new NextRequest("http://localhost/api/customers", {
      method: "POST",
      body: JSON.stringify({ name: "New Customer" }),
    });

    const res = await customerRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.customer.name).toBe("New Customer");
    expect(data.customer.companyId).toBe(companyA.id);
  });

  it("should list only customers belonging to the actor's company", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyA.id, USER_A);
    await createTestMember(companyB.id, USER_B);

    await prisma.customer.create({
      data: { name: "Customer A", companyId: companyA.id }
    });
    await prisma.customer.create({
      data: { name: "Customer B", companyId: companyB.id }
    });

    (auth as any).mockResolvedValue({ userId: USER_A });

    const res = await customerRoute.GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Customer A");
    expect(data.pagination.total).toBe(1);
  });
});
