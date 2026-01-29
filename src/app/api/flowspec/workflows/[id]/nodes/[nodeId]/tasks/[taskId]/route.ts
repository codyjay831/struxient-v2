/**
 * Task API - Update, Delete
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
  params: Promise<{ id: string; nodeId: string; taskId: string }>;
};

/**
 * Update a Task.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;
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

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.nodeId !== nodeId) {
      return apiError("TASK_NOT_FOUND", "Task not found", null, 404);
    }

    // Check name uniqueness if changed
    if (name && name !== task.name) {
      const existing = await prisma.task.findFirst({
        where: { nodeId, name },
      });
      if (existing) {
        return apiError("NAME_EXISTS", `A task with name "${name}" already exists`);
      }
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        name: name ?? undefined,
        instructions: instructions ?? undefined,
        evidenceRequired: evidenceRequired ?? undefined,
        evidenceSchema: evidenceSchema ?? undefined,
        displayOrder: displayOrder ?? undefined,
      },
    });

    return apiSuccess({ task: updated });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Delete a Task.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.nodeId !== nodeId) {
      return apiError("TASK_NOT_FOUND", "Task not found", null, 404);
    }

    await prisma.task.delete({ where: { id: taskId } });

    return apiSuccess({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
