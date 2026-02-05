/**
 * Builder-specific Workflow API
 * 
 * Implements "Buffer-First" logic for the workflow builder.
 * If a draft buffer exists, it returns the WIP state.
 * Otherwise, it returns the canonical relational state.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership } from "@/lib/auth/tenant";
import { apiSuccess, apiError, apiRouteError } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { getDraftBuffer } from "@/lib/flowspec/persistence/draft-buffer";
import { WorkflowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id: workflowId } = await params;

    // 1. Fetch the workflow metadata
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: {
          include: {
            tasks: {
              include: {
                outcomes: true,
                crossFlowDependencies: true,
              },
            },
            outboundGates: true,
            inboundGates: true,
          },
        },
        gates: true,
        fanOutRules: true,
      },
    });

    if (!workflow) {
      return apiError("WORKFLOW_NOT_FOUND", "Workflow not found", null, 404);
    }

    const { companyId, authority } = await verifyTenantOwnership(workflow.companyId);

    // 2. Buffer-First logic for DRAFT/VALIDATED
    if (workflow.status !== WorkflowStatus.PUBLISHED) {
      const buffer = await getDraftBuffer(workflowId, companyId);
      
      if (buffer) {
        // We found a WIP buffer. Merge metadata with buffer content.
        const content = buffer.content as any;
        
        // Harmonize buffer content with WorkflowWithRelations shape
        // REQUIREMENT: Return UNION of nodes (Truth + Buffer)
        const relationalNodes = workflow.nodes;
        const bufferedNodes = (content.nodes ?? []) as any[];
        
        // Map buffered nodes by ID for fast lookup
        const bufferedNodeMap = new Map(bufferedNodes.map(bn => [bn.id, bn]));
        
        // 1. Start with all relational nodes (Truth) and overlay buffered semantic fields
        const mergedNodes = relationalNodes.map((rn) => {
          const bn = bufferedNodeMap.get(rn.id);
          const rnData = JSON.parse(JSON.stringify(rn)); // Ensure plain object for spread
          if (bn) {
            bufferedNodeMap.delete(rn.id); // Mark handled
            return {
              ...rnData,
              ...bn,
              // Position rule: Truth when valid, otherwise fall back to buffer
              position: rn.position ?? bn.position
            };
          }
          return rnData; // Relational-only node (Truth)
        });

        // 2. Include buffered-only nodes not in Truth (new nodes)
        for (const bn of bufferedNodeMap.values()) {
          mergedNodes.push(bn);
        }

        const workflowData = JSON.parse(JSON.stringify(workflow));
        const builderWorkflow = {
          ...workflowData,
          name: content.name ?? workflow.name,
          description: content.description ?? workflow.description,
          isNonTerminating: content.isNonTerminating ?? workflow.isNonTerminating,
          nodes: mergedNodes,
          gates: content.gates ?? workflow.gates,
          // Flag indicating this is from buffer
          _isDraft: true,
          _bufferUpdatedAt: buffer.updatedAt,
          _baseEventId: buffer.baseEventId,
        };
        
        return apiSuccess({ workflow: builderWorkflow }, 200, authority);
      }
    }

    // 3. Fallback to relational state
    const plainWorkflow = JSON.parse(JSON.stringify(workflow));
    return apiSuccess({ workflow: plainWorkflow }, 200, authority);
  } catch (error) {
    return apiRouteError(error);
  }
}
