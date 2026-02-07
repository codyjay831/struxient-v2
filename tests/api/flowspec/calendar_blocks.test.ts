import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as blocksRoute from "@/app/api/flowspec/calendar-blocks/route";

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
  // Ordered cleanup to satisfy foreign keys
  await prisma.scheduleBlock.deleteMany({});
  await prisma.scheduleChangeRequest.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Scheduling Blocks API", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return empty list when no blocks exist", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const req = new NextRequest("http://localhost/api/scheduling/blocks");
    const res = await blocksRoute.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.blocks).toEqual([]);
  });

  it("should return schedule blocks for the current tenant", async () => {
    const company = await createTestCompany();
    const otherCompany = await createTestCompany("Other Company");
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Create block for current tenant
    await prisma.scheduleBlock.create({
      data: {
        companyId: company.id,
        timeClass: "COMMITTED",
        startAt: new Date("2026-02-10T09:00:00Z"),
        endAt: new Date("2026-02-10T11:00:00Z"),
        createdBy: MOCK_USER_ID,
      }
    });

    // Create block for other tenant (should NOT be returned)
    await prisma.scheduleBlock.create({
      data: {
        companyId: otherCompany.id,
        timeClass: "PLANNED",
        startAt: new Date("2026-02-10T12:00:00Z"),
        endAt: new Date("2026-02-10T14:00:00Z"),
        createdBy: "other_user",
      }
    });

    const req = new NextRequest("http://localhost/api/scheduling/blocks");
    const res = await blocksRoute.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.blocks.length).toBe(1);
    expect(data.blocks[0].companyId).toBe(company.id);
    expect(data.blocks[0].timeClass).toBe("COMMITTED");
  });

  it("should filter out superseded blocks", async () => {
    const company = await createTestCompany();
    await createTestMember(company.id, MOCK_USER_ID);
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    // Active block
    await prisma.scheduleBlock.create({
      data: {
        companyId: company.id,
        timeClass: "PLANNED",
        startAt: new Date("2026-02-11T09:00:00Z"),
        endAt: new Date("2026-02-11T10:00:00Z"),
        createdBy: MOCK_USER_ID,
      }
    });

    // Superseded block
    await prisma.scheduleBlock.create({
      data: {
        companyId: company.id,
        timeClass: "PLANNED",
        startAt: new Date("2026-02-11T08:00:00Z"),
        endAt: new Date("2026-02-11T09:00:00Z"),
        createdBy: MOCK_USER_ID,
        supersededAt: new Date(),
        supersededBy: "new_block_id",
      }
    });

    const req = new NextRequest("http://localhost/api/scheduling/blocks");
    const res = await blocksRoute.GET(req);
    const data = await res.json();

    expect(data.blocks.length).toBe(1);
    expect(data.blocks[0].supersededAt).toBeNull();
  });
});
