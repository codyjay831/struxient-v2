/**
 * Tenancy API - Company Creation
 *
 * Canon Source: docs/canon/tenancy/10_tenancy_contract.md
 */

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Create a new Company and become its OWNER.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session.userId) {
      return apiError("UNAUTHORIZED", "Authentication required", null, 401);
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return apiError("NAME_REQUIRED", "Company name is required");
    }

    // Create the company and the first member (OWNER) in a transaction
    const company = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name: name.trim(),
        },
      });

      await tx.companyMember.create({
        data: {
          companyId: newCompany.id,
          userId: session.userId,
          role: "OWNER",
        },
      });

      return newCompany;
    });

    return apiSuccess({ company }, 201);
  } catch (error) {
    console.error("Failed to create company", error);
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred", null, 500);
  }
}
