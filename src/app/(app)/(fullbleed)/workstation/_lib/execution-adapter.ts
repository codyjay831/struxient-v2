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
    const err = new Error(error.message || "Failed to start task");
    (err as any).code = error.code || error.error?.code;
    throw err;
  }
  return response.json();
}

export async function apiRecordOutcome(flowId: string, taskId: string, outcome: string) {
  const response = await fetch(`/api/flowspec/flows/${flowId}/tasks/${taskId}/outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome }),
  });
  if (!response.ok) {
    const error = await response.json();
    const err = new Error(error.message || "Failed to record outcome");
    (err as any).code = error.code || error.error?.code;
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
    const err = new Error(error.message || "Failed to attach evidence");
    (err as any).code = error.code || error.error?.code;
    throw err;
  }
  return response.json();
}
