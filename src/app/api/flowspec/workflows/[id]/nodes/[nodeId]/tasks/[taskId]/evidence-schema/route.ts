/**
 * Evidence Schema API - Update
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.6
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
 * Configure Evidence Schema for a Task.
 */
export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;
    const body = await request.json();
    const { schema } = body;

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

    // INV-025: Schema must have a valid type field
    if (!schema || typeof schema !== "object") {
      return apiError("INVALID_SCHEMA", "Evidence schema must be a valid JSON object");
    }

    const validTypes = ["file", "text", "structured"];
    if (!("type" in schema) || !validTypes.includes(schema.type)) {
      return apiError(
        "INVALID_SCHEMA_TYPE",
        "Evidence schema must have a type field with value 'file', 'text', or 'structured' (INV-025)"
      );
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        evidenceSchema: schema as any,
      },
    });

    return apiSuccess({ task: updated });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
