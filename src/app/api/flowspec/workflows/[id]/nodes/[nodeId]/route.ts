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
import { updateNodeInBuffer, deleteNodeFromBuffer } from "@/lib/flowspec/persistence/draft-buffer";

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
    const { name, isEntry, nodeKind, completionRule, position, specificTasks } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { companyId, userId } = await verifyTenantOwnership(workflow.companyId);

    // INV-026 Enforcement: Auto-revert VALIDATED to DRAFT (Policy B)
    try {
      await ensureDraftForStructuralEdit(workflowId);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
    }

    // Identify if this is a semantic change or just layout
    const semanticUpdates: any = {};
    if (name !== undefined) semanticUpdates.name = name;
    if (isEntry !== undefined) semanticUpdates.isEntry = isEntry;
    if (nodeKind !== undefined) semanticUpdates.nodeKind = nodeKind;
    if (completionRule !== undefined) semanticUpdates.completionRule = completionRule;
    if (specificTasks !== undefined) semanticUpdates.specificTasks = specificTasks;

    const isSemantic = Object.keys(semanticUpdates).length > 0;

    if (isSemantic) {
      // 1. Write semantic changes to the buffer (WIP)
      await updateNodeInBuffer(workflowId, companyId, nodeId, semanticUpdates, userId);
      
      // For semantic changes, we don't update the relational table yet!
      // This is the "Staged" principle.
      return apiSuccess({ message: "Changes staged to draft buffer" });
    }

    // 2. Layout changes (Position) go direct to relational tables (Autosave)
    if (position !== undefined) {
      const updated = await prisma.node.update({
        where: { id: nodeId },
        data: { position: position as any },
      });
      return apiSuccess({ node: updated });
    }

    return apiSuccess({ message: "No changes detected" });
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

    const { companyId, userId } = await verifyTenantOwnership(workflow.companyId);

    // INV-026 Enforcement: Auto-revert VALIDATED to DRAFT (Policy B)
    try {
      await ensureDraftForStructuralEdit(workflowId);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
    }

    // Deleting a node is a semantic change. Stage it in the buffer.
    await deleteNodeFromBuffer(workflowId, companyId, nodeId, userId);

    return apiSuccess({ message: "Node deletion staged to draft buffer" });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
