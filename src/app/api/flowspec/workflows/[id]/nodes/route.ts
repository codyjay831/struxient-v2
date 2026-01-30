/**
 * Node API - Create
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.2
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Create a new Node in a Workflow.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { name, isEntry, completionRule, position } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-026 Enforcement: Auto-revert VALIDATED to DRAFT (Policy B)
    try {
      await ensureDraftForStructuralEdit(workflowId);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
    }

    if (!name) {
      return apiError("NAME_REQUIRED", "Node name is required");
    }

    // Check for unique name within workflow
    const existing = await prisma.node.findFirst({
      where: { workflowId, name },
    });

    if (existing) {
      return apiError("NAME_EXISTS", `A node with name "${name}" already exists in this workflow`);
    }

    const node = await prisma.node.create({
      data: {
        workflowId,
        name,
        isEntry: isEntry ?? false,
        completionRule: completionRule ?? "ALL_TASKS_DONE",
        position: position ?? undefined,
      },
    });

    return apiSuccess({ node }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
