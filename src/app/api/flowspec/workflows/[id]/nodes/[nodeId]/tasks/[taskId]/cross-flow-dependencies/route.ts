/**
 * Cross-Flow Dependency API - Add, List
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.7
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiList } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; nodeId: string; taskId: string }>;
};

/**
 * List Cross-Flow Dependencies for a Task.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, taskId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(workflow.companyId);

    const dependencies = await prisma.crossFlowDependency.findMany({
      where: { taskId },
    });

    return apiList(dependencies, dependencies.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Add a Cross-Flow Dependency to a Task.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId, nodeId, taskId } = await params;
    const body = await request.json();
    const { sourceWorkflowId, sourceTaskPath, requiredOutcome } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    if (!sourceWorkflowId || !sourceTaskPath || !requiredOutcome) {
      return apiError("INPUT_REQUIRED", "sourceWorkflowId, sourceTaskPath, and requiredOutcome are required");
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.nodeId !== nodeId) {
      return apiError("TASK_NOT_FOUND", "Task not found", null, 404);
    }

    // Verify source workflow exists
    const sourceWorkflow = await prisma.workflow.findUnique({
      where: { id: sourceWorkflowId },
    });

    if (!sourceWorkflow) {
      return apiError("SOURCE_WORKFLOW_NOT_FOUND", `Source workflow ${sourceWorkflowId} not found`);
    }

    const dependency = await prisma.crossFlowDependency.create({
      data: {
        taskId,
        sourceWorkflowId,
        sourceTaskPath,
        requiredOutcome,
      },
    });

    return apiSuccess({ dependency }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
