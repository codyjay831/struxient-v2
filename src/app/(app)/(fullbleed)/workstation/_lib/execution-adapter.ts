/**
 * Work Station Execution Adapter
 * 
 * Sole entry point for FlowSpec execution mutations from the UI.
 * This centralization allows for mechanical enforcement of the 
 * "Work Station as Sole Execution Surface" monopoly (WS-ED-02).
 */

export async function apiStartTask(flowId: string, taskId: string) {
  const response = await fetch(`/api/flowspec/flows/${flowId}/tasks/${taskId}/start`, {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json();
    const message = error.error?.message || error.message || "Failed to start task";
    const err = new Error(message);
    (err as any).code = error.error?.code || error.code;
    throw err;
  }
  return response.json();
}

export async function apiRecordOutcome(flowId: string, taskId: string, outcome: string, detourId?: string, metadata?: any) {
  const response = await fetch(`/api/flowspec/flows/${flowId}/tasks/${taskId}/outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome, detourId, metadata }),
  });
  if (!response.ok) {
    const error = await response.json();
    const message = error.error?.message || error.message || "Failed to record outcome";
    const err = new Error(message);
    (err as any).code = error.error?.code || error.code;
    throw err;
  }
  return response.json();
}

export async function apiAttachEvidence(flowId: string, taskId: string, type: string, data: any, idempotencyKey?: string) {
  const response = await fetch(`/api/flowspec/flows/${flowId}/tasks/${taskId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, data, idempotencyKey }),
  });
  if (!response.ok) {
    const error = await response.json();
    const message = error.error?.message || error.message || "Failed to attach evidence";
    const err = new Error(message);
    (err as any).code = error.error?.code || error.code;
    throw err;
  }
  return response.json();
}

/**
 * Get a signed upload URL for evidence file upload.
 */
export async function apiGetSignedUploadUrl(
  flowId: string,
  taskId: string,
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; storageKey: string; expiresAt: string; bucket: string }> {
  const response = await fetch(`/api/tenancy/vault/sign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flowId, taskId, fileName, mimeType }),
  });
  if (!response.ok) {
    const error = await response.json();
    const message = error.error?.message || error.message || "Failed to get upload URL";
    const err = new Error(message);
    (err as any).code = error.error?.code || error.code;
    throw err;
  }
  const result = await response.json();
  return result;
}

/**
 * Upload a file to S3 using a pre-signed URL.
 */
export async function uploadFileToStorage(
  uploadUrl: string,
  file: File
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
}

export async function apiGetTaskDetail(flowId: string, taskId: string) {
  const response = await fetch(`/api/flowspec/flows/${flowId}/tasks/${taskId}`);
  if (!response.ok) {
    const error = await response.json();
    const message = error.error?.message || error.message || "Failed to fetch task detail";
    const err = new Error(message);
    (err as any).code = error.error?.code || error.code;
    throw err;
  }
  const result = await response.json();
  return result.task;
}
