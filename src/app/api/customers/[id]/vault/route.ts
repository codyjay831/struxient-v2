import { prisma } from "@/lib/prisma";
import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

interface VaultEntry {
  id: string;
  flowId: string;
  workflowName: string;
  jobId: string;
  jobAddress: string | null;
  taskId: string;
  type: string;
  data: unknown;
  attachedAt: Date;
  attachedBy: string;
}

/**
 * Customer Evidence Vault Projection: Aggregates all EvidenceAttachment records across all Jobs.
 * GET /api/customers/[id]/vault
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

    const vault: VaultEntry[] = [];

    for (const job of customer.jobs) {
      for (const flow of job.flowGroup.flows) {
        flow.evidenceAttachments.forEach((ea) => {
          vault.push({
            id: ea.id,
            flowId: flow.id,
            workflowName: flow.workflow.name,
            jobId: job.id,
            jobAddress: job.address,
            taskId: ea.taskId,
            type: ea.type,
            data: ea.data,
            attachedAt: ea.attachedAt,
            attachedBy: ea.attachedBy,
          });
        });
      }
    }

    // Sort by attachedAt desc
    vault.sort((a, b) => new Date(b.attachedAt).getTime() - new Date(a.attachedAt).getTime());

    return apiSuccess({ vault }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
