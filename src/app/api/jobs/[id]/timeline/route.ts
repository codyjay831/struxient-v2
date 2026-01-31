import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

interface TimelineEvent {
  type: "NODE_ACTIVATED" | "TASK_STARTED" | "TASK_OUTCOME" | "EVIDENCE_ATTACHED";
  timestamp: Date;
  flowId: string;
  workflowName: string;
  id: string; // Stable record ID for tie-breaking
  nodeId?: string;
  taskId?: string;
  iteration?: number;
  outcome?: string;
  outcomeBy?: string | null;
  startedBy?: string | null;
  evidenceType?: string;
  attachedBy?: string;
}

/**
 * Job Card Execution Timeline Projection: chronological ledger derived from FlowSpec truth.
 * GET /api/jobs/[id]/timeline
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const { companyId, authority } = await getActorTenantContext();

    const job = await prisma.job.findUnique({
      where: { id, companyId },
      select: {
        flowGroupId: true,
      },
    });

    if (!job) {
      return apiError("JOB_NOT_FOUND", "Job not found", null, 404);
    }

    const flows = await prisma.flow.findMany({
      where: { flowGroupId: job.flowGroupId },
      include: {
        workflow: {
          select: { name: true },
        },
        nodeActivations: true,
        taskExecutions: true,
        evidenceAttachments: true,
      },
    });

    // Flatten and transform events into a chronological ledger
    const timeline: TimelineEvent[] = [];

    for (const flow of flows) {
      // 1. Node Activations
      flow.nodeActivations.forEach((na) => {
        timeline.push({
          type: "NODE_ACTIVATED",
          timestamp: na.activatedAt,
          flowId: flow.id,
          workflowName: flow.workflow.name,
          id: na.id,
          nodeId: na.nodeId,
          iteration: na.iteration,
        });
      });

      // 2. Task Starts
      flow.taskExecutions.forEach((te) => {
        if (te.startedAt) {
          timeline.push({
            type: "TASK_STARTED",
            timestamp: te.startedAt,
            flowId: flow.id,
            workflowName: flow.workflow.name,
            id: `start-${te.id}`,
            taskId: te.taskId,
            startedBy: te.startedBy,
            iteration: te.iteration,
          });
        }

        // 3. Outcomes
        if (te.outcomeAt && te.outcome) {
          timeline.push({
            type: "TASK_OUTCOME",
            timestamp: te.outcomeAt,
            flowId: flow.id,
            workflowName: flow.workflow.name,
            id: `outcome-${te.id}`,
            taskId: te.taskId,
            outcome: te.outcome,
            outcomeBy: te.outcomeBy,
            iteration: te.iteration,
          });
        }
      });

      // 4. Evidence Attachments
      flow.evidenceAttachments.forEach((ea) => {
        timeline.push({
          type: "EVIDENCE_ATTACHED",
          timestamp: ea.attachedAt,
          flowId: flow.id,
          workflowName: flow.workflow.name,
          id: ea.id,
          taskId: ea.taskId,
          evidenceType: ea.type,
          attachedBy: ea.attachedBy,
        });
      });
    }

    // Sort by timestamp (asc) and tie-break with type order
    const typeOrder = {
      NODE_ACTIVATED: 1,
      TASK_STARTED: 2,
      EVIDENCE_ATTACHED: 3,
      TASK_OUTCOME: 4,
    };

    timeline.sort((a, b) => {
      const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      
      const typeDiff = (typeOrder[a.type as keyof typeof typeOrder] || 0) - (typeOrder[b.type as keyof typeof typeOrder] || 0);
      if (typeDiff !== 0) return typeDiff;

      // Final stable tie-breaker
      return a.id.localeCompare(b.id);
    });

    return apiSuccess({ timeline }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
