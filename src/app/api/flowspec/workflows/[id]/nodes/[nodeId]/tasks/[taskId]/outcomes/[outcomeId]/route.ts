/**
 * Outcome API - Update, Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { ensureDraftForStructuralEdit } from "@/lib/flowspec/persistence/workflow";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string; taskId: string; outcomeId: string }>;
};

/**
 * Update an Outcome.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, taskId, outcomeId } = await params;
    const body = await request.json();
    const { name } = body;

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

    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    if (!outcome || outcome.taskId !== taskId) {
      return apiError("OUTCOME_NOT_FOUND", "Outcome not found", null, 404);
    }

    // Check name uniqueness if changed
    if (name && name !== outcome.name) {
      const existing = await prisma.outcome.findFirst({
        where: { taskId, name },
      });
      if (existing) {
        return apiError("NAME_EXISTS", `An outcome with name "${name}" already exists`);
      }
    }

    const updated = await prisma.outcome.update({
      where: { id: outcomeId },
      data: {
        name: name ?? undefined,
      },
    });

    return apiSuccess({ outcome: updated });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete an Outcome.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, taskId, outcomeId } = await params;

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

    const outcome = await prisma.outcome.findUnique({ where: { id: outcomeId } });
    if (!outcome || outcome.taskId !== taskId) {
      return apiError("OUTCOME_NOT_FOUND", "Outcome not found", null, 404);
    }

    // Rule: Route must be deleted first (or cascade handled by DB)
    // Prisma schema has onDelete: Cascade for outcomes, but we should be careful.
    
    await prisma.outcome.delete({ where: { id: outcomeId } });

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
