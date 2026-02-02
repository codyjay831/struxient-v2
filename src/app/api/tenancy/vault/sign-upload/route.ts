/**
 * Vault Signed Upload API
 *
 * Generates pre-signed S3 URLs for evidence file uploads.
 * Located under /api/tenancy/vault to align with company-wide evidence storage patterns.
 *
 * Canon Source: Evidence System (Epic 06)
 *
 * INVARIANT: Binary data is NEVER stored in the database.
 * EvidenceAttachment.data contains pointer metadata only.
 */

import { prisma } from "@/lib/prisma";
import { verifyTenantOwnership, tenantErrorResponse, getActorTenantContext } from "@/lib/auth/tenant";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { generateSignedUploadUrl, isStorageConfigured } from "@/lib/storage";
import { getFlow } from "@/lib/flowspec/engine";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Generate a pre-signed upload URL for evidence file.
 * POST /api/tenancy/vault/sign-upload
 *
 * Body:
 * {
 *   flowId: string,
 *   taskId: string,
 *   fileName: string,
 *   mimeType: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, authority } = await getActorTenantContext();
    const body = await request.json();
    const { flowId, taskId, fileName, mimeType } = body;

    // Validate storage is configured
    if (!isStorageConfigured()) {
      return apiError(
        "STORAGE_NOT_CONFIGURED",
        "File storage is not configured. Contact your administrator.",
        null,
        503
      );
    }

    // Validate required fields
    if (!flowId || !taskId || !fileName || !mimeType) {
      return apiError(
        "INPUT_REQUIRED",
        "flowId, taskId, fileName, and mimeType are required"
      );
    }

    // Validate fileName (prevent path traversal)
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
      return apiError(
        "INVALID_FILENAME",
        "fileName cannot contain path separators or '..' sequences"
      );
    }

    // Get flow and verify tenant ownership
    const flow = await getFlow(flowId);
    if (!flow) {
      return apiError("FLOW_NOT_FOUND", "Flow not found", null, 404);
    }

    // Ensure the flow belongs to the actor's company
    if (flow.workflow.companyId !== companyId) {
      return apiError("TENANT_ACCESS_DENIED", "Flow does not belong to your company", null, 403);
    }

    // Verify taskId exists in the workflow snapshot
    const snapshot = flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
    let taskExists = false;
    for (const node of snapshot.nodes) {
      if (node.tasks.some((t) => t.id === taskId)) {
        taskExists = true;
        break;
      }
    }

    if (!taskExists) {
      return apiError(
        "TASK_NOT_FOUND",
        "Task not found in workflow",
        { taskId },
        404
      );
    }

    // Generate signed upload URL
    const result = await generateSignedUploadUrl(
      companyId,
      flowId,
      taskId,
      fileName,
      mimeType,
      900 // 15 minutes expiration
    );

    return apiSuccess({
      uploadUrl: result.uploadUrl,
      storageKey: result.storageKey,
      expiresAt: result.expiresAt.toISOString(),
      bucket: result.bucket,
    }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
