/**
 * FlowGroup Policy API
 *
 * Policy affects timing/signals ONLY, never workflow structure.
 * Merge semantics: Override (B) > Default (A) > null
 *
 * Canon Source: Policy Contract v1.0
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getFlowGroupPolicy, validateTaskOverrides, validateJobPriority } from "@/lib/flowspec/policy";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Get FlowGroupPolicy with task overrides.
 * GET /api/flowspec/flow-groups/[id]/policy
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: flowGroupId } = await params;

    const flowGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
    });

    if (!flowGroup) {
      return apiError("FLOW_GROUP_NOT_FOUND", "Flow Group not found", null, 404);
    }

    const { authority } = await verifyTenantOwnership(flowGroup.companyId);

    const policy = await getFlowGroupPolicy(flowGroupId);

    // Return empty policy structure if none exists
    if (!policy) {
      return apiSuccess({
        policy: {
          flowGroupId,
          jobPriority: "NORMAL",
          groupDueAt: null,
          taskOverrides: [],
        },
      }, 200, authority);
    }

    return apiSuccess({
      policy: {
        id: policy.id,
        flowGroupId: policy.flowGroupId,
        jobPriority: policy.jobPriority,
        groupDueAt: policy.groupDueAt,
        taskOverrides: policy.taskOverrides.map((o) => ({
          taskId: o.taskId,
          slaHours: o.slaHours,
        })),
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      },
    }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

/**
 * Upsert FlowGroupPolicy with task overrides.
 * PUT /api/flowspec/flow-groups/[id]/policy
 *
 * Body:
 * {
 *   jobPriority?: "LOW" | "NORMAL" | "HIGH" | "URGENT",
 *   groupDueAt?: string | null,
 *   taskOverrides?: { taskId: string, slaHours: number | null }[]
 * }
 */
export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const { id: flowGroupId } = await params;
    const body = await request.json();
    const { jobPriority, groupDueAt, taskOverrides } = body;

    // Validate flowGroup exists
    const flowGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId },
      include: {
        flows: {
          include: {
            workflowVersion: true,
          },
        },
      },
    });

    if (!flowGroup) {
      return apiError("FLOW_GROUP_NOT_FOUND", "Flow Group not found", null, 404);
    }

    await verifyTenantOwnership(flowGroup.companyId);

    // Validate jobPriority if provided
    if (jobPriority !== undefined && !validateJobPriority(jobPriority)) {
      return apiError(
        "INVALID_JOB_PRIORITY",
        "jobPriority must be one of: LOW, NORMAL, HIGH, URGENT"
      );
    }

    // Validate taskOverrides against bound workflow version snapshot
    if (taskOverrides && Array.isArray(taskOverrides) && taskOverrides.length > 0) {
      // Get snapshots from all flows in the group to validate taskIds
      const allValidTaskIds = new Set<string>();
      
      for (const flow of flowGroup.flows) {
        const snapshot = flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
        if (snapshot?.nodes) {
          for (const node of snapshot.nodes) {
            for (const task of node.tasks) {
              allValidTaskIds.add(task.id);
            }
          }
        }
      }

      const validationResult = validateTaskOverrides(taskOverrides, {
        workflowId: "",
        version: 0,
        name: "",
        description: null,
        isNonTerminating: false,
        nodes: flowGroup.flows.flatMap((f) => {
          const snapshot = f.workflowVersion.snapshot as unknown as WorkflowSnapshot;
          return snapshot?.nodes ?? [];
        }),
        gates: [],
      });

      if (!validationResult.valid) {
        return apiError(
          "INVALID_TASK_OVERRIDES",
          "Task override validation failed",
          { errors: validationResult.errors }
        );
      }
    }

    // Upsert policy
    const policy = await prisma.flowGroupPolicy.upsert({
      where: { flowGroupId },
      create: {
        flowGroupId,
        jobPriority: jobPriority ?? "NORMAL",
        groupDueAt: groupDueAt ? new Date(groupDueAt) : null,
      },
      update: {
        ...(jobPriority !== undefined && { jobPriority }),
        ...(groupDueAt !== undefined && { groupDueAt: groupDueAt ? new Date(groupDueAt) : null }),
      },
    });

    // Handle task overrides if provided
    if (taskOverrides && Array.isArray(taskOverrides)) {
      // Delete existing overrides and recreate
      await prisma.taskPolicyOverride.deleteMany({
        where: { flowGroupPolicyId: policy.id },
      });

      if (taskOverrides.length > 0) {
        await prisma.taskPolicyOverride.createMany({
          data: taskOverrides.map((o: { taskId: string; slaHours?: number | null }) => ({
            flowGroupPolicyId: policy.id,
            taskId: o.taskId,
            slaHours: o.slaHours ?? null,
          })),
        });
      }
    }

    // Fetch updated policy with overrides
    const updatedPolicy = await getFlowGroupPolicy(flowGroupId);

    return apiSuccess({
      policy: {
        id: updatedPolicy!.id,
        flowGroupId: updatedPolicy!.flowGroupId,
        jobPriority: updatedPolicy!.jobPriority,
        groupDueAt: updatedPolicy!.groupDueAt,
        taskOverrides: updatedPolicy!.taskOverrides.map((o) => ({
          taskId: o.taskId,
          slaHours: o.slaHours,
        })),
        createdAt: updatedPolicy!.createdAt,
        updatedAt: updatedPolicy!.updatedAt,
      },
    }, 200);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
