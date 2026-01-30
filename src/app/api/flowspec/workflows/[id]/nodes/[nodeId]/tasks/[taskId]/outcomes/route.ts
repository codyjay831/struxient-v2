/**
 * Outcome API - Add
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
  params: Promise<{ id: string; nodeId: string; taskId: string }>;
};

/**
 * Add an Outcome to a Task.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, taskId } = await params;
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

    if (!name) {
      return apiError("NAME_REQUIRED", "Outcome name is required");
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return apiError("TASK_NOT_FOUND", "Task not found", null, 404);
    }

    // Check for unique name within task
    const existing = await prisma.outcome.findFirst({
      where: { taskId, name },
    });

    if (existing) {
      return apiError("NAME_EXISTS", `An outcome with name "${name}" already exists for this task`);
    }

    const outcome = await prisma.outcome.create({
      data: {
        taskId,
        name,
      },
    });

    return apiSuccess({ outcome }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
