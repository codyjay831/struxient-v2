"use client";

/**
 * Task Execution Content Component
 * 
 * Hollowed out version for inline expansion.
 * NO shell, NO back buttons, NO JobHeader.
 * ONLY instructions, evidence, and outcome recording.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, AlertCircle, CheckCircle2, Paperclip } from "lucide-react";
import { apiStartTask, apiRecordOutcome } from "../_lib/execution-adapter";
import type { ActionableTask } from "./task-feed";
import { EvidenceList } from "./evidence-list";
import { EvidenceForm } from "./evidence-form";
import { DetourBanner } from "./detour-banner";
import { OpenDetourDialog } from "./open-detour-dialog";
import { DetourControls } from "./detour-controls";

interface TaskExecutionContentProps {
  task: ActionableTask;
  onComplete: () => void;
}

type SubmissionState = "idle" | "starting" | "submitting" | "success" | "error";

export function TaskExecutionContent({ task, onComplete }: TaskExecutionContentProps) {
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
    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
      {task._detour && <div className="mb-4"><DetourBanner detour={task._detour} /></div>}

      <Card className="border-2 shadow-none bg-muted/5">
        <CardHeader className="py-4 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">Execution: {task.taskName}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">
                {task.flowId}:{task.taskId}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              {task.evidenceRequired && (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                  Evidence Required
                </Badge>
              )}
              
              <div className="flex gap-2">
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

        <CardContent className="pt-4 space-y-6">
          {state === "starting" && (
            <Alert className="py-2">
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
              <AlertDescription className="text-xs">Starting Task...</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
              Instructions
            </h3>
            <div className="p-3 rounded border bg-background text-sm leading-relaxed">
              {task.instructions || "No special instructions for this task."}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold">Evidence</h3>
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

          {state === "error" && error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {state === "success" && (
            <Alert className="py-2 border-green-500 bg-green-50">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <AlertDescription className="text-xs text-green-700">
                Success. Refreshing...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-3 border-t bg-muted/10 p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground text-center">
            Record Outcome
          </h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {task.allowedOutcomes.map((outcome) => (
              <Button
                key={outcome}
                size="sm"
                disabled={isOutcomeDisabled}
                onClick={() => handleRecordOutcome(outcome)}
                className="min-w-[100px] h-8 text-xs font-bold"
              >
                {state === "submitting" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {!state.includes("submitting") && <Send className="mr-2 h-3 w-3" />}
                {outcome}
              </Button>
            ))}
          </div>
          {task.evidenceRequired && evidenceCount === 0 && (
            <p className="text-[10px] text-amber-600 font-bold text-center">
              EVIDENCE REQUIRED
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
