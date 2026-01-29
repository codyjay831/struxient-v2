/**
 * Fan-Out Rule API - Add, List
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §2.8
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiList } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { WorkflowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * List Fan-Out Rules for a Workflow.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(workflow.companyId);

    const rules = await prisma.fanOutRule.findMany({
      where: { workflowId },
    });

    return apiList(rules, rules.length, 0, 100, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Add a Fan-Out Rule to a Workflow.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { sourceNodeId, triggerOutcome, targetWorkflowId } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    await verifyTenantOwnership(workflow.companyId);

    // INV-011: Published Immutable
    if (workflow.status === WorkflowStatus.PUBLISHED) {
      return apiError("PUBLISHED_IMMUTABLE", "Published workflows cannot be modified", null, 403);
    }

    if (!sourceNodeId || !triggerOutcome || !targetWorkflowId) {
      return apiError("INPUT_REQUIRED", "sourceNodeId, triggerOutcome, and targetWorkflowId are required");
    }

    // Verify source node exists
    const sourceNode = await prisma.node.findUnique({ where: { id: sourceNodeId } });
    if (!sourceNode || sourceNode.workflowId !== workflowId) {
      return apiError("NODE_NOT_FOUND", `Source node ${sourceNodeId} not found in this workflow`);
    }

    // Verify target workflow exists
    const targetWorkflow = await prisma.workflow.findUnique({
      where: { id: targetWorkflowId },
    });

    if (!targetWorkflow) {
      return apiError("TARGET_WORKFLOW_NOT_FOUND", `Target workflow ${targetWorkflowId} not found`);
    }

    const rule = await prisma.fanOutRule.create({
      data: {
        workflowId,
        sourceNodeId,
        triggerOutcome,
        targetWorkflowId,
      },
    });

    return apiSuccess({ rule }, 201);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
