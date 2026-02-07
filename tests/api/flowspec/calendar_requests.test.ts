import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as requestsRoute from "@/app/api/flowspec/calendar-requests/route";

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
  await prisma.scheduleBlock.deleteMany({});
  await prisma.scheduleChangeRequest.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Calendar Requests API (Phase E1)", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should create a PENDING request for the correct companyId", async () => {
    const company = await createTestCompany();
    const member = await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const reqBody = {
      taskId: "task_1",
      reason: "Crew rescheduled",
      metadata: { requestedStart: "2026-02-10T10:00:00Z" }
    };

    const req = new NextRequest("http://localhost/api/flowspec/calendar-requests", {
      method: "POST",
      body: JSON.stringify(reqBody)
    });

    const res = await requestsRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.changeRequest.companyId).toBe(company.id);
    expect(data.changeRequest.status).toBe("PENDING");
    expect(data.changeRequest.requestedBy).toBe(member.id);
    expect(data.changeRequest.reason).toBe("Crew rescheduled");
  });

  it("should NOT mutate existing schedule blocks on request creation", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Create an initial block
    const block = await prisma.scheduleBlock.create({
      data: {
        companyId: company.id,
        timeClass: "COMMITTED",
        startAt: new Date("2026-02-10T09:00:00Z"),
        endAt: new Date("2026-02-10T11:00:00Z"),
        createdBy: MOCK_USER_ID,
      }
    });

    const reqBody = {
      taskId: "task_1",
      reason: "Intent to change",
      metadata: { requestedStart: "2026-02-10T15:00:00Z" }
    };

    const req = new NextRequest("http://localhost/api/flowspec/calendar-requests", {
      method: "POST",
      body: JSON.stringify(reqBody)
    });

    await requestsRoute.POST(req);

    // Verify block is unchanged
    const unchangedBlock = await prisma.scheduleBlock.findUnique({
      where: { id: block.id }
    });
    
    expect(unchangedBlock?.startAt.toISOString()).toBe(block.startAt.toISOString());
    expect(unchangedBlock?.supersededAt).toBeNull();
  });

  it("should deny requests for other tenants", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    
    // User belongs to Company A
    await createTestMember(companyA.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const reqBody = {
      reason: "Attempted cross-tenant request",
      // If we somehow tried to specify companyB in the body, it should still use companyA from context
      companyId: companyB.id 
    };

    const req = new NextRequest("http://localhost/api/flowspec/calendar-requests", {
      method: "POST",
      body: JSON.stringify(reqBody)
    });

    const res = await requestsRoute.POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.changeRequest.companyId).toBe(companyA.id); // Enforced by context
    expect(data.changeRequest.companyId).not.toBe(companyB.id);
  });

  it("should require a reason", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const reqBody = {
      taskId: "task_1"
      // reason missing
    };

    const req = new NextRequest("http://localhost/api/flowspec/calendar-requests", {
      method: "POST",
      body: JSON.stringify(reqBody)
    });

    const res = await requestsRoute.POST(req);
    expect(res.status).toBe(400);
  });
});
