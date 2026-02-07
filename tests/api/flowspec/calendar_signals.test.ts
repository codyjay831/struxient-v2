import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as signalsRoute from "@/app/api/flowspec/calendar-signals/route";

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

describe("Calendar Signals API (Phase F0)", () => {
  const MOCK_USER_ID = "user_signals_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return signals for the current tenant only", async () => {
    const companyA = await createTestCompany("Company A");
    const companyB = await createTestCompany("Company B");
    await createTestMember(companyA.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Create an overlap in Company A
    await prisma.scheduleBlock.createMany({
      data: [
        {
          companyId: companyA.id, resourceId: "res1", timeClass: "COMMITTED",
          startAt: new Date("2026-02-10T09:00:00Z"), endAt: new Date("2026-02-10T11:00:00Z"), createdBy: MOCK_USER_ID
        },
        {
          companyId: companyA.id, resourceId: "res1", timeClass: "COMMITTED",
          startAt: new Date("2026-02-10T10:00:00Z"), endAt: new Date("2026-02-10T12:00:00Z"), createdBy: MOCK_USER_ID
        }
      ]
    });

    // Create an overlap in Company B (should be ignored)
    await prisma.scheduleBlock.createMany({
      data: [
        {
          companyId: companyB.id, resourceId: "res2", timeClass: "COMMITTED",
          startAt: new Date("2026-02-10T09:00:00Z"), endAt: new Date("2026-02-10T11:00:00Z"), createdBy: "other"
        },
        {
          companyId: companyB.id, resourceId: "res2", timeClass: "COMMITTED",
          startAt: new Date("2026-02-10T10:00:00Z"), endAt: new Date("2026-02-10T12:00:00Z"), createdBy: "other"
        }
      ]
    });

    const req = new NextRequest("http://localhost/api/flowspec/calendar-signals");
    const res = await signalsRoute.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.signals.length).toBe(1);
    expect(data.signals[0].what).toContain("res1");
    expect(data.signals[0].what).not.toContain("res2");
  });
});
