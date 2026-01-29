/**
 * Version API - List
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.9
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiList, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * List Published versions of a Workflow.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(workflow.companyId);

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.workflowVersion.count({ where: { workflowId } });

    return apiList(versions, total, offset, limit, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
