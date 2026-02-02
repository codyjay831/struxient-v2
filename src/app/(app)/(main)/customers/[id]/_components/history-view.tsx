"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, History, Clock, ArrowRight, User, FileText, CheckCircle2, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface HistoryEvent {
  type: "NODE_ACTIVATED" | "TASK_STARTED" | "TASK_OUTCOME" | "EVIDENCE_ATTACHED";
  timestamp: string;
  flowId: string;
  workflowName: string;
  jobId: string;
  jobAddress: string | null;
  id: string;
  nodeId?: string;
  taskId?: string;
  iteration?: number;
  outcome?: string;
  outcomeBy?: string | null;
  startedBy?: string | null;
  evidenceType?: string;
  attachedBy?: string;
}

interface HistoryViewProps {
  customerId: string;
}

export function HistoryView({ customerId }: HistoryViewProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/history`);
      if (!response.ok) throw new Error("Failed to fetch customer history");
      const data = await response.json();
      setEvents(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Reconstructing history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <History className="h-12 w-12 text-muted-foreground/20 mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">No historical events found for this customer.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <History className="h-5 w-5 text-primary" />
          Lifetime Relationship Ledger
        </CardTitle>
        <CardDescription>Append-only stream of truth interleaved from all jobs.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 border-t">
        <div className="divide-y">
          {events.map((event) => (
            <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="mt-1">
                    {event.type === "NODE_ACTIVATED" && <Activity className="h-4 w-4 text-blue-500" />}
                    {event.type === "TASK_STARTED" && <Clock className="h-4 w-4 text-amber-500" />}
                    {event.type === "TASK_OUTCOME" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {event.type === "EVIDENCE_ATTACHED" && <FileText className="h-4 w-4 text-purple-500" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {event.type === "NODE_ACTIVATED" && `Node ${event.nodeId} Activated`}
                        {event.type === "TASK_STARTED" && `Task ${event.taskId} Started`}
                        {event.type === "TASK_OUTCOME" && `Outcome Recorded: ${event.outcome}`}
                        {event.type === "EVIDENCE_ATTACHED" && `Evidence Attached: ${event.evidenceType}`}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {event.workflowName}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                      {event.type === "TASK_OUTCOME" && event.outcomeBy && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By: {event.outcomeBy}
                        </span>
                      )}
                      {event.type === "TASK_STARTED" && event.startedBy && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By: {event.startedBy}
                        </span>
                      )}
                      {event.type === "EVIDENCE_ATTACHED" && event.attachedBy && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By: {event.attachedBy}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Job</span>
                      <Link href={`/jobs/${event.jobId}`} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                        {event.jobAddress || event.jobId.substring(0, 8)}
                        <ArrowRight className="h-2 w-2" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
