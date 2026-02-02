import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import * as meRoute from "@/app/api/tenancy/me/route";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

async function cleanupTestData() {
  await prisma.jobAssignment.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.evidenceAttachment.deleteMany({});
  await prisma.taskExecution.deleteMany({});
  await prisma.nodeActivation.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.taskPolicyOverride.deleteMany({});
  await prisma.flowGroupPolicy.deleteMany({});
  await prisma.flowGroup.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.company.deleteMany({});
}

describe("Responsibility Hardening: /api/tenancy/me", () => {
  const MOCK_USER_ID = "user_123";

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  it("T-MeEndpoint-MinimalShape: Returns only memberId, companyId, and timestamp", async () => {
    const company = await prisma.company.create({ data: { name: "Hardening Co" } });
    await prisma.companyMember.create({
      data: { companyId: company.id, userId: MOCK_USER_ID, role: "OWNER" }
    });
    (auth as any).mockResolvedValue({ userId: MOCK_USER_ID });

    const req = new NextRequest("http://localhost/api/tenancy/me");
    const res = await meRoute.GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    
    // Exact keys check
    const keys = Object.keys(data).sort();
    expect(keys).toEqual(["companyId", "memberId", "timestamp"]);
    
    // Negative check: no forbidden identity/auth keys
    expect(data.userId).toBeUndefined();
    expect(data.role).toBeUndefined();
    expect(data.capabilities).toBeUndefined();
  });
});
