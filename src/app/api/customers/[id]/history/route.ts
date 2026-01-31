import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

interface HistoryEvent {
  type: "NODE_ACTIVATED" | "TASK_STARTED" | "TASK_OUTCOME" | "EVIDENCE_ATTACHED";
  timestamp: Date;
  flowId: string;
  workflowName: string;
  jobId: string;
  jobAddress: string | null;
  id: string; // record ID for tie-breaking
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
 * Customer Lifetime Ledger Projection: chronological ledger derived from FlowSpec truth across ALL jobs.
 * GET /api/customers/[id]/history
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const { companyId, authority } = await getActorTenantContext();

    const customer = await prisma.customer.findUnique({
      where: { id, companyId },
      include: {
        jobs: {
          include: {
            flowGroup: {
              include: {
                flows: {
                  include: {
                    workflow: {
                      select: { name: true },
                    },
                    nodeActivations: true,
                    taskExecutions: true,
                    evidenceAttachments: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return apiError("CUSTOMER_NOT_FOUND", "Customer not found", null, 404);
    }

    const history: HistoryEvent[] = [];

    for (const job of customer.jobs) {
      for (const flow of job.flowGroup.flows) {
        // 1. Node Activations
        flow.nodeActivations.forEach((na) => {
          history.push({
            type: "NODE_ACTIVATED",
            timestamp: na.activatedAt,
            flowId: flow.id,
            workflowName: flow.workflow.name,
            jobId: job.id,
            jobAddress: job.address,
            id: na.id,
            nodeId: na.nodeId,
            iteration: na.iteration,
          });
        });

        // 2. Task Starts
        flow.taskExecutions.forEach((te) => {
          if (te.startedAt) {
            history.push({
              type: "TASK_STARTED",
              timestamp: te.startedAt,
              flowId: flow.id,
              workflowName: flow.workflow.name,
              jobId: job.id,
              jobAddress: job.address,
              id: `start-${te.id}`,
              taskId: te.taskId,
              startedBy: te.startedBy,
              iteration: te.iteration,
            });
          }

          // 3. Outcomes
          if (te.outcomeAt && te.outcome) {
            history.push({
              type: "TASK_OUTCOME",
              timestamp: te.outcomeAt,
              flowId: flow.id,
              workflowName: flow.workflow.name,
              jobId: job.id,
              jobAddress: job.address,
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
          history.push({
            type: "EVIDENCE_ATTACHED",
            timestamp: ea.attachedAt,
            flowId: flow.id,
            workflowName: flow.workflow.name,
            jobId: job.id,
            jobAddress: job.address,
            id: ea.id,
            taskId: ea.taskId,
            evidenceType: ea.type,
            attachedBy: ea.attachedBy,
          });
        });
      }
    }

    // Deterministic Sort: timestamp -> typeOrder -> jobId -> recordId
    const typeOrder = {
      NODE_ACTIVATED: 1,
      TASK_STARTED: 2,
      EVIDENCE_ATTACHED: 3,
      TASK_OUTCOME: 4,
    };

    history.sort((a, b) => {
      const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;

      const typeDiff = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
      if (typeDiff !== 0) return typeDiff;

      const jobDiff = a.jobId.localeCompare(b.jobId);
      if (jobDiff !== 0) return jobDiff;

      return a.id.localeCompare(b.id);
    });

    return apiSuccess({ history }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
