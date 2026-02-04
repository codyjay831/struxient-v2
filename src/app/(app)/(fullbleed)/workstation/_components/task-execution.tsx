"use client";

/**
 * Task Execution Component
 * 
 * Canon Source: 10_workstation_contract.md §4.1.4, §4.1.5, §4.1.6
 * - §4.1.4: Collect Outcome Selection
 * - §4.1.5: Submit to FlowSpec
 * - §4.1.6: Handle Rejections gracefully
 * 
 * WS-INV-006: Graceful Stale State Handling
 * WS-INV-007: Refresh After Submission (handled by parent)
 * 
 * Auto-starts task when component mounts (Canon §2.5: auto-start on Outcome recording allowed).
 * Boundary: Uses API only, no direct FlowSpec engine imports.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, ArrowLeft, AlertCircle, CheckCircle2, Info, Paperclip } from "lucide-react";
import { apiStartTask, apiRecordOutcome } from "../_lib/execution-adapter";
import type { ActionableTask } from "./task-feed";
import { EvidenceList } from "./evidence-list";
import { EvidenceForm } from "./evidence-form";
import { JobHeader } from "./job-header";
import { DetourBanner } from "./detour-banner";
import { OpenDetourDialog } from "./open-detour-dialog";
import { DetourControls } from "./detour-controls";
import { DetourDebugPanel } from "./detour-debug-panel";

interface TaskExecutionProps {
  task: ActionableTask;
  onBack: () => void;
  onComplete: () => void;
}

type SubmissionState = "idle" | "starting" | "submitting" | "success" | "error";

export function TaskExecution({ task, onBack, onComplete }: TaskExecutionProps) {
  const [state, setState] = useState<SubmissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(!!task.startedAt);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [evidenceRefreshKey, setEvidenceRefreshKey] = useState(0);

  // Auto-start task when component mounts if not already started
  useEffect(() => {
    if (!isStarted) {
      startTask();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTask = async () => {
    setState("starting");
    setError(null);
    try {
      await apiStartTask(task.flowId, task.taskId);

      setIsStarted(true);
      setState("idle");
    } catch (err) {
      if ((err as any).code === "TASK_ALREADY_STARTED") {
        setIsStarted(true);
        setState("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to start task");
      setState("error");
    }
  };

  const handleRecordOutcome = async (outcome: string) => {
    setState("submitting");
    setError(null);

    try {
      await apiRecordOutcome(task.flowId, task.taskId, outcome, (task as any)._detour?.id);

      setState("success");

      // WS-INV-007: Trigger refresh after successful submission
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      if ((err as any).code === "EVIDENCE_REQUIRED") {
        setEvidenceRefreshKey(k => k + 1);
      }
      setError(err instanceof Error ? err.message : "Failed to record outcome");
      setState("error");
    }
  };

  const handleEvidenceAttached = useCallback(() => {
    setEvidenceRefreshKey(k => k + 1);
  }, []);

  const isOutcomeDisabled = 
    state === "starting" || 
    state === "submitting" || 
    state === "success" || 
    !isStarted ||
    (task.evidenceRequired && evidenceCount === 0);

  return (
    <div className="space-y-4 pb-20">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} disabled={state === "submitting"}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Task List
      </Button>

      <JobHeader flowGroupId={task.flowGroupId} />

      {task._detour && <DetourBanner detour={task._detour} />}

      <Card className="shadow-lg border-2">
        {/* Header */}
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{task.taskName}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span>{task.workflowName}</span>
                <span>•</span>
                <span>{task.nodeName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Job: {task.flowGroupId}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge variant="secondary">{task.domainHint}</Badge>
              {task.evidenceRequired && (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                  Evidence Required
                </Badge>
              )}
              
              {/* ADMIN CONTROLS */}
              <div className="pt-2 flex flex-col gap-2 items-end">
                {!task._detour && task.latestTaskExecutionId && (
                  <OpenDetourDialog 
                    flowId={task.flowId}
                    nodeId={task.nodeId}
                    nodeName={task.nodeName}
                    checkpointTaskExecutionId={task.latestTaskExecutionId}
                    possibleResumeNodes={(task as any)._metadata?.possibleResumeNodes || []}
                    onDetourOpened={onComplete}
                  />
                )}
                {task._detour && (
                  <DetourControls 
                    detourId={task._detour.id as string}
                    flowId={task.flowId}
                    type={task._detour.type}
                    status={task._detour.status}
                    onUpdated={onComplete}
                  />
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="pt-6 space-y-8">
          {/* Starting state */}
          {state === "starting" && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Starting Task</AlertTitle>
              <AlertDescription>Preparing task for work...</AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Instructions
            </h3>
            <div className="p-4 rounded-md bg-muted/50 text-sm leading-relaxed min-h-[80px]">
              {task.instructions || "No special instructions for this task."}
            </div>
          </div>

          {/* Evidence Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Paperclip className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-foreground">Evidence</h3>
            </div>

            <EvidenceList
              flowId={task.flowId}
              taskId={task.taskId}
              refreshKey={evidenceRefreshKey}
              onEvidenceCountChange={setEvidenceCount}
            />

            <EvidenceForm
              flowId={task.flowId}
              taskId={task.taskId}
              evidenceSchema={task.evidenceSchema}
              evidenceRequired={task.evidenceRequired}
              onAttached={handleEvidenceAttached}
            />
          </div>

          {/* Error display (WS-INV-006) */}
          {state === "error" && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Submission Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {state === "success" && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700">Success</AlertTitle>
              <AlertDescription className="text-green-600">
                Outcome recorded successfully. Refreshing work list...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        {/* Outcome buttons */}
        <CardFooter className="flex-col items-stretch gap-4 border-t bg-muted/10 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-center">
            Record Outcome
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {task.allowedOutcomes.map((outcome) => (
              <Button
                key={outcome}
                size="lg"
                disabled={isOutcomeDisabled}
                onClick={() => handleRecordOutcome(outcome)}
                className="min-w-[140px]"
              >
                {state === "submitting" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {outcome}
              </Button>
            ))}
          </div>
          {!isStarted && state !== "starting" && (
            <p className="text-sm text-muted-foreground text-center">
              Task must be started before recording an outcome.
            </p>
          )}
          {task.evidenceRequired && evidenceCount === 0 && (
            <p className="text-sm text-amber-600 font-medium text-center">
              Evidence is required before you can record an outcome.
            </p>
          )}
        </CardFooter>
      </Card>

      <DetourDebugPanel flowId={task.flowId} />
    </div>
  );
}
