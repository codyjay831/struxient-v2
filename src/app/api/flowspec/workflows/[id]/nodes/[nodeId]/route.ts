/**
 * Node API - Update, Delete
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
  params: Promise<{ id: string; nodeId: string }>;
};

/**
 * Update a Node.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId } = await params;
    const body = await request.json();
    const { name, isEntry, completionRule, position, specificTasks } = body;

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

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.workflowId !== workflowId) {
      return apiError("NODE_NOT_FOUND", "Node not found", null, 404);
    }

    // Check name uniqueness if changed
    if (name && name !== node.name) {
      const existing = await prisma.node.findFirst({
        where: { workflowId, name },
      });
      if (existing) {
        return apiError("NAME_EXISTS", `A node with name "${name}" already exists`);
      }
    }

    const updated = await prisma.node.update({
      where: { id: nodeId },
      data: {
        name: name ?? undefined,
        isEntry: isEntry ?? undefined,
        completionRule: completionRule ?? undefined,
        position: position ?? undefined,
        specificTasks: specificTasks ?? undefined,
      },
    });

    return apiSuccess({ node: updated });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete a Node.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId } = await params;

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

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.workflowId !== workflowId) {
      return apiError("NODE_NOT_FOUND", "Node not found", null, 404);
    }

    await prisma.node.delete({ where: { id: nodeId } });

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
