import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiList } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * List customers for actor's tenant or create a new customer.
 * GET /api/customers
 * POST /api/customers
 */

export async function GET() {
  try {
    const { companyId, authority } = await getActorTenantContext();

    const customers = await prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    });

    return apiList(customers, customers.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return apiError("INVALID_INPUT", "Customer name is required");
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        companyId,
      },
    });

    return apiSuccess({ customer }, 201, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
