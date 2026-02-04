/**
 * Workflow API - Get, Update, Delete
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §3.1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import {
  updateWorkflow,
  deleteWorkflow,
  workflowNameExists,
  ensureDraftForStructuralEdit,
} from "@/lib/flowspec/persistence/workflow";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Get a specific Workflow.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        nodes: {
          include: {
            tasks: {
              include: {
                outcomes: true,
                crossFlowDependencies: true,
              },
            },
          },
        },
        gates: true,
        fanOutRules: true,
      },
    });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(workflow.companyId);

    return apiSuccess({ workflow }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Update a Workflow (Draft only).
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, isNonTerminating } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(workflow.companyId);

    // INV-026 Enforcement: Auto-revert VALIDATED to DRAFT (Policy B)
    try {
      await ensureDraftForStructuralEdit(id);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
    }

    // Check name uniqueness if changed
    if (name && name !== workflow.name) {
      if (await workflowNameExists(workflow.companyId, name, workflow.version, id)) {
        return apiError("NAME_EXISTS", "A workflow with this name already exists");
      }
    }

    const updated = await updateWorkflow(id, {
      name: name ?? undefined,
      description: description ?? undefined,
      isNonTerminating: isNonTerminating ?? undefined,
    });

    return apiSuccess({ workflow: updated }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete a Workflow.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const workflow = await prisma.workflow.findUnique({ where: { id } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const tenantCtx = await verifyTenantOwnership(workflow.companyId);

    // Enforce deletion rules: Not Published (INV-011)
    try {
      await deleteWorkflow(id, tenantCtx);
    } catch (err: any) {
      if (err.code === "PUBLISHED_IMMUTABLE") {
        return apiError("PUBLISHED_IMMUTABLE", err.message, null, 403);
      }
      throw err;
    }

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
