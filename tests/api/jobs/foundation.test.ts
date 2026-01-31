import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as jobByIdRoute from "@/app/api/jobs/[id]/route";
import * as jobByFgRoute from "@/app/api/jobs/by-flow-group/[flowGroupId]/route";
import * as jobsRoute from "@/app/api/jobs/route";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

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

async function createTestFlowGroup(companyId: string, scopeId: string) {
  return prisma.flowGroup.create({
    data: {
      companyId,
      scopeType: "job",
      scopeId,
    },
  });
}

async function cleanupTestData() {
  await prisma.job.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Phase 3 / M1: Job & Customer Foundation API Tests", () => {
  const USER_A = "user_tenant_a";
  const USER_B = "user_tenant_b";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should fetch job by ID only if user belongs to the same tenant", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyA.id, USER_A);
    await createTestMember(companyB.id, USER_B);

    const customerA = await prisma.customer.create({
      data: { name: "Customer A", companyId: companyA.id }
    });

    const fgA = await createTestFlowGroup(companyA.id, "job_a");

    const jobA = await prisma.job.create({
      data: {
        companyId: companyA.id,
        customerId: customerA.id,
        flowGroupId: fgA.id,
        address: "123 Tenant A St"
      }
    });

    // 1. User A (same tenant) should succeed
    (auth as any).mockResolvedValue({ userId: USER_A });
    const reqA = new NextRequest(`http://localhost/api/jobs/${jobA.id}`);
    const resA = await jobByIdRoute.GET(reqA, { params: Promise.resolve({ id: jobA.id }) });
    const dataA = await resA.json();

    expect(resA.status).toBe(200);
    expect(dataA.job.address).toBe("123 Tenant A St");
    expect(dataA.job.customer.name).toBe("Customer A");

    // 2. User B (different tenant) should be forbidden
    (auth as any).mockResolvedValue({ userId: USER_B });
    const reqB = new NextRequest(`http://localhost/api/jobs/${jobA.id}`);
    const resB = await jobByIdRoute.GET(reqB, { params: Promise.resolve({ id: jobA.id }) });
    
    expect(resB.status).toBe(403);
  });

  it("should resolve job by FlowGroup ID", async () => {
    const company = await createTestCompany("Test Company");
    await createTestMember(company.id, USER_A);
    (auth as any).mockResolvedValue({ userId: USER_A });

    const customer = await prisma.customer.create({
      data: { name: "Test Customer", companyId: company.id }
    });

    const fg = await createTestFlowGroup(company.id, "job_test");

    await prisma.job.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        flowGroupId: fg.id,
        address: "456 Flow St"
      }
    });

    const req = new NextRequest(`http://localhost/api/jobs/by-flow-group/${fg.id}`);
    const res = await jobByFgRoute.GET(req, { params: Promise.resolve({ flowGroupId: fg.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.job.address).toBe("456 Flow St");
    expect(data.job.customer.name).toBe("Test Customer");
  });

  it("should return job: null if job metadata is missing for an existing FlowGroup", async () => {
    const company = await createTestCompany("Test Company");
    await createTestMember(company.id, USER_A);
    (auth as any).mockResolvedValue({ userId: USER_A });

    const fg = await createTestFlowGroup(company.id, "fg_no_job");

    const req = new NextRequest(`http://localhost/api/jobs/by-flow-group/${fg.id}`);
    const res = await jobByFgRoute.GET(req, { params: Promise.resolve({ flowGroupId: fg.id }) });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.job).toBe(null);
  });

  it("should return 404 if FlowGroup itself is missing", async () => {
    const company = await createTestCompany("Test Company");
    await createTestMember(company.id, USER_A);
    (auth as any).mockResolvedValue({ userId: USER_A });

    const req = new NextRequest(`http://localhost/api/jobs/by-flow-group/fg_missing`);
    const res = await jobByFgRoute.GET(req, { params: Promise.resolve({ flowGroupId: "fg_missing" }) });
    
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("FLOW_GROUP_NOT_FOUND");
  });

  it("should enforce unique FlowGroup ↔ Job relationship", async () => {
    const company = await createTestCompany("Test Company");
    const customer = await prisma.customer.create({
      data: { name: "Test Customer", companyId: company.id }
    });

    const fg = await createTestFlowGroup(company.id, "job_unique");

    await prisma.job.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        flowGroupId: fg.id,
        address: "Addr 1"
      }
    });

    // Attempting to create another job with same flowGroupId should fail at DB level (Unique constraint)
    // Satisfies FK but violates @unique
    await expect(prisma.job.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        flowGroupId: fg.id,
        address: "Addr 2"
      }
    })).rejects.toThrow();
  });

  it("should not allow cross-tenant access via flowGroupId", async () => {
    // Tenant A setup
    const companyA = await createTestCompany("Company A");
    await createTestMember(companyA.id, USER_A);
    const customerA = await prisma.customer.create({
      data: { name: "Customer A", companyId: companyA.id }
    });
    const fgA = await createTestFlowGroup(companyA.id, "job_a");
    await prisma.job.create({
      data: {
        companyId: companyA.id,
        customerId: customerA.id,
        flowGroupId: fgA.id,
        address: "123 Tenant A St"
      }
    });

    // Tenant B setup
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyB.id, USER_B);

    // Authenticate as Tenant B
    (auth as any).mockResolvedValue({ userId: USER_B });

    // Try to access Tenant A's Job via FlowGroup ID
    const req = new NextRequest(`http://localhost/api/jobs/by-flow-group/${fgA.id}`);
    const res = await jobByFgRoute.GET(req, { params: Promise.resolve({ flowGroupId: fgA.id }) });
    
    // Status MUST be 403 (or equivalent forbidden error used elsewhere in the suite)
    expect(res.status).toBe(403);
    
    // Response MUST NOT include Job metadata or Customer data
    const data = await res.json();
    expect(data.job).toBeUndefined();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("NO_MEMBERSHIP"); // "User has no company membership" maps to 403/NO_MEMBERSHIP
  });

  it("should enforce onDelete: Restrict on FlowGroup", async () => {
    const company = await createTestCompany("Test Company");
    const fg = await createTestFlowGroup(company.id, "job_restrict");
    const customer = await prisma.customer.create({
      data: { name: "Test Customer", companyId: company.id }
    });
    
    await prisma.job.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        flowGroupId: fg.id,
      }
    });

    // Attempting to delete FlowGroup should fail due to @relation(onDelete: Restrict)
    await expect(prisma.flowGroup.delete({
      where: { id: fg.id }
    })).rejects.toThrow();

    // Verify it's a Prisma P2003 error
    try {
      await prisma.flowGroup.delete({ where: { id: fg.id } });
    } catch (e) {
      expect(e).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((e as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
    }
  });

  it("should prevent cross-tenant Job creation via foreign flowGroupId", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyB.id, USER_B);

    const fgA = await createTestFlowGroup(companyA.id, "job_a");
    const customerB = await prisma.customer.create({
      data: { name: "Customer B", companyId: companyB.id }
    });

    (auth as any).mockResolvedValue({ userId: USER_B });

    const req = new NextRequest("http://localhost/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        customerId: customerB.id,
        flowGroupId: fgA.id,
      }),
    });

    const res = await jobsRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
    expect(data.error.message).toContain("FlowGroup belongs to a different tenant");
  });

  it("should prevent cross-tenant Job creation via foreign customerId", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyB.id, USER_B);

    const fgB = await createTestFlowGroup(companyB.id, "job_b");
    const customerA = await prisma.customer.create({
      data: { name: "Customer A", companyId: companyA.id }
    });

    (auth as any).mockResolvedValue({ userId: USER_B });

    const req = new NextRequest("http://localhost/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        customerId: customerA.id,
        flowGroupId: fgB.id,
      }),
    });

    const res = await jobsRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
    expect(data.error.message).toContain("Customer belongs to a different tenant");
  });

  it("should return 409 if a job already exists for the FlowGroup", async () => {
    const company = await createTestCompany("Test Company");
    await createTestMember(company.id, USER_A);
    const customer = await prisma.customer.create({
      data: { name: "Test Customer", companyId: company.id }
    });
    const fg = await createTestFlowGroup(company.id, "job_conflict");

    // Create first job
    await prisma.job.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        flowGroupId: fg.id,
      }
    });

    (auth as any).mockResolvedValue({ userId: USER_A });

    const req = new NextRequest("http://localhost/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        customerId: customer.id,
        flowGroupId: fg.id,
      }),
    });

    const res = await jobsRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error.code).toBe("JOB_ALREADY_EXISTS");
  });
});
