/**
 * Task Detail API
 *
 * Canon Source: 30_workstation_ui_api_map.md §4
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getFlow, getWorkflowSnapshot } from "@/lib/flowspec/engine";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ flowId: string; taskId: string }>;
};

/**
 * Get detailed information for a Task within a Flow.
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { flowId, taskId } = await params;

    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(flow.workflow.companyId);

    const snapshot = getWorkflowSnapshot(flow);
    let targetNode = null;
    let targetTask = null;

    for (const node of snapshot.nodes) {
      const task = node.tasks.find((t) => t.id === taskId);
      if (task) {
        targetNode = node;
        targetTask = task;
        break;
      }
    }

    if (!targetTask || !targetNode) {
      return apiError("TASK_NOT_FOUND", "Task not found in workflow", null, 404);
    }

    // Determine domain hint (simplified for v2)
    // In v2, we might look at workflow names or metadata. 
    // For now we'll derive it from the workflow name.
    const domainHint = flow.workflow.name.toLowerCase().includes("finance") 
      ? "finance" 
      : flow.workflow.name.toLowerCase().includes("sales") 
        ? "sales" 
        : "execution";

    // Check if task is started
    const execution = flow.taskExecutions.find(te => te.taskId === taskId);

    // TOP-TIER: Fetch "Live" metadata from Master definition to detect snapshot mismatch
    // 1. Find the current node in the Master workflow by name
    const masterNode = await prisma.node.findFirst({
      where: { workflowId: flow.workflowId, name: targetNode.name },
      include: { tasks: { where: { name: targetTask.name } } }
    });
    const masterTask = masterNode?.tasks[0];

    const taskDetail = {
      taskId: targetTask.id,
      taskName: targetTask.name,
      flowId: flow.id,
      flowGroupId: flow.flowGroupId,
      workflowId: flow.workflowId,
      workflowName: flow.workflow.name,
      nodeId: targetNode.id,
      nodeName: targetNode.name,
      allowedOutcomes: targetTask.outcomes.map(o => o.name),
      evidenceRequired: targetTask.evidenceRequired,
      evidenceSchema: targetTask.evidenceSchema,
      domainHint,
      startedAt: execution?.startedAt || null,
      instructions: targetTask.instructions,
      metadata: targetTask.metadata,
      masterMetadata: masterTask?.metadata || null,
    };

    return apiSuccess({ task: taskDetail }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
