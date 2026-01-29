/**
 * Tenant Isolation Layer
 *
 * Canon Source: implementation_plan.md §1.3, §1.3.2
 *
 * This module enforces tenant boundaries (companyId boundary).
 * It verifies that an authenticated actor belongs to the same company
 * as the resource being accessed.
 */

import { auth } from "@clerk/nextjs/server";
import { prisma } from "../prisma";
import { buildAuthorityContext, type AuthorityContext } from "./capabilities";

export class TenantIsolationError extends Error {
  constructor(message: string = "Tenant isolation violation") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

/**
 * Result of tenant verification.
 */
export interface TenantContext {
  companyId: string;
  authority: AuthorityContext;
}

/**
 * Verifies that the currently authenticated user belongs to the specified company.
 *
 * @param companyId - The ID of the company to check ownership against
 * @throws TenantIsolationError if the user does not belong to the company
 * @returns The tenant context including companyId and authority
 */
export async function verifyTenantOwnership(companyId: string): Promise<TenantContext> {
  const session = await auth();
  
  if (!session.userId) {
    throw new TenantIsolationError("Authentication required");
  }

  // Get the actor's companyId from our database
  const member = await prisma.companyMember.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: session.userId,
      },
    },
  });

  if (!member) {
    throw new TenantIsolationError("User has no company membership");
  }

  return {
    companyId: member.companyId,
    authority: buildAuthorityContext(member),
  };
}

/**
 * Gets the current actor's tenant context.
 * Used for creation endpoints where the resource inherits the actor's tenant.
 *
 * @returns The actor's tenant context
 * @throws TenantIsolationError if not authenticated or no company membership found
 */
export async function getActorTenantContext(): Promise<TenantContext> {
  const session = await auth();
  
  if (!session.userId) {
    throw new TenantIsolationError("Authentication required");
  }

  let member = await prisma.companyMember.findFirst({
    where: { userId: session.userId },
  });

  // DEV ONLY: Auto-provision company for first-time developers
  if (!member && process.env.NODE_ENV === "development" && process.env.STRUXIENT_DEV_AUTO_PROVISION === "true") {
    console.log(`[DEV] Auto-provisioning company for user ${session.userId}`);
    const company = await prisma.company.create({
      data: {
        name: "Dev Company",
        members: {
          create: {
            userId: session.userId,
            role: "OWNER",
          },
        },
      },
    });
    member = await prisma.companyMember.findFirst({
      where: { companyId: company.id, userId: session.userId },
    });
  }

  if (!member) {
    throw new TenantIsolationError("User has no company membership");
  }

  return {
    companyId: member.companyId,
    authority: buildAuthorityContext(member),
  };
}

/**
 * Gets the current actor's companyId (legacy helper).
 */
export async function getActorCompanyId(): Promise<string> {
  const ctx = await getActorTenantContext();
  return ctx.companyId;
}

/**
 * Standardized error response for API routes.
 */
export function tenantErrorResponse(error: unknown) {
  if (error instanceof TenantIsolationError) {
    const isNoMembership = error.message === "User has no company membership";
    return new Response(
      JSON.stringify({
        error: {
          code: isNoMembership ? "NO_MEMBERSHIP" : "FORBIDDEN",
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
      timestamp: new Date().toISOString(),
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
