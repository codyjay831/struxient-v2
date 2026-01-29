/**
 * Task API - Create
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.3
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string }>;
};

/**
 * Create a new Task in a Node.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId } = await params;
    const body = await request.json();
    const { name, instructions, evidenceRequired, evidenceSchema, displayOrder } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.workflowId !== workflowId) {
      return apiError("NODE_NOT_FOUND", "Node not found", null, 404);
    }

    if (!name) {
      return apiError("NAME_REQUIRED", "Task name is required");
    }

    // Check for unique name within node
    const existing = await prisma.task.findFirst({
      where: { nodeId, name },
    });

    if (existing) {
      return apiError("NAME_EXISTS", `A task with name "${name}" already exists in this node`);
    }

    const task = await prisma.task.create({
      data: {
        nodeId,
        name,
        instructions,
        evidenceRequired: evidenceRequired ?? false,
        evidenceSchema: evidenceSchema ?? undefined,
        displayOrder: displayOrder ?? 0,
      },
    });

    return apiSuccess({ task }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
