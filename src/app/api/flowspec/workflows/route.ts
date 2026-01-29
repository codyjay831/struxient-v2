/**
 * Workflow API - List and Create
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.1
 */

import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiList } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * List Workflows for the current tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const workflows = await prisma.workflow.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.workflow.count({ where: { companyId } });

    return apiList(workflows, total, offset, limit, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Create a new Workflow for the current tenant.
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return apiError("NAME_REQUIRED", "Workflow name is required");
    }

    // Check for unique name within tenant
    const existing = await prisma.workflow.findFirst({
      where: { companyId, name, version: 1 },
    });

    if (existing) {
      return apiError("NAME_EXISTS", "A workflow with this name already exists");
    }

    const workflow = await prisma.workflow.create({
      data: {
        companyId,
        name,
        description,
        status: "DRAFT",
        version: 1,
      },
    });

    return apiSuccess({ workflow }, 201, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
