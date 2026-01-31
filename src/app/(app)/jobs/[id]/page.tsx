"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, User, MapPin, Clock, History, FileText, CheckCircle2, Play, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface TimelineEvent {
  type: "NODE_ACTIVATED" | "TASK_STARTED" | "TASK_OUTCOME" | "EVIDENCE_ATTACHED";
  timestamp: string;
  flowId: string;
  workflowName: string;
  nodeId?: string;
  taskId?: string;
  iteration?: number;
  outcome?: string;
  outcomeBy?: string;
  startedBy?: string;
  evidenceType?: string;
  attachedBy?: string;
}

interface Job {
  id: string;
  address: string | null;
  flowGroupId: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
  };
}

export default function JobCardPage() {
  const { id } = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobRes, timelineRes] = await Promise.all([
        fetch(`/api/jobs/${id}`),
        fetch(`/api/jobs/${id}/timeline`)
      ]);

      if (!jobRes.ok) throw new Error("Failed to fetch job metadata");
      if (!timelineRes.ok) throw new Error("Failed to fetch job timeline");

      const jobData = await jobRes.json();
      const timelineData = await timelineRes.json();

      setJob(jobData.job);
      setTimeline(timelineData.timeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading job card...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || "Job not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Card</h1>
            <p className="text-muted-foreground font-mono text-xs">ID: {job.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/workstation?job=${job.flowGroupId}`}>
            <Button className="w-full md:w-auto">
              <Play className="mr-2 h-4 w-4" />
              Go to Work Station
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Section A: Metadata */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Metadata</CardTitle>
              <CardDescription>Identity and relationship context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <Link href={`/customers/${job.customer.id}`} className="font-semibold hover:underline">
                    {job.customer.name}
                  </Link>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service Address</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="font-medium text-sm">{job.address || "No Address Provided"}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Created At</p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p>{new Date(job.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-foreground font-bold uppercase">Flow Group ID</span>
                  <span className="font-mono bg-primary/5 px-1.5 py-0.5 rounded border">{job.flowGroupId}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground italic">
                Note: This is a read-only projection surface. Actions and truth mutations must be performed in the Work Station.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section B: Execution Timeline Projection */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="min-h-[500px]">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Execution Ledger
                  </CardTitle>
                  <CardDescription>Append-only truth stream from FlowSpec.</CardDescription>
                </div>
                <Badge variant="outline">{timeline.length} Events</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground/20" />
                  <p className="mt-4 text-sm text-muted-foreground font-medium">No execution history found</p>
                  <p className="text-xs text-muted-foreground mt-1">This FlowGroup has no recorded truth events yet.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical Line */}
                  <div className="absolute left-[39px] top-0 bottom-0 w-px bg-border" />
                  
                  <div className="divide-y">
                    {timeline.map((event, index) => (
                      <div key={index} className="flex gap-4 p-4 items-start relative bg-background hover:bg-muted/20 transition-colors">
                        <div className="flex flex-col items-center min-w-[50px] pt-1">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-background z-10 ${
                            event.type === "TASK_OUTCOME" ? "bg-green-100 text-green-600" :
                            event.type === "NODE_ACTIVATED" ? "bg-blue-100 text-blue-600" :
                            event.type === "EVIDENCE_ATTACHED" ? "bg-amber-100 text-amber-600" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {event.type === "TASK_OUTCOME" && <CheckCircle2 className="h-3 w-3" />}
                            {event.type === "NODE_ACTIVATED" && <Play className="h-3 w-3 fill-current" />}
                            {event.type === "EVIDENCE_ATTACHED" && <FileText className="h-3 w-3" />}
                            {event.type === "TASK_STARTED" && <Clock className="h-3 w-3" />}
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-semibold leading-none">
                              {event.type === "NODE_ACTIVATED" && `Node Activated: ${event.nodeId}`}
                              {event.type === "TASK_STARTED" && `Task Started: ${event.taskId}`}
                              {event.type === "TASK_OUTCOME" && `Outcome Recorded: ${event.outcome}`}
                              {event.type === "EVIDENCE_ATTACHED" && `Evidence Attached to ${event.taskId}`}
                            </p>
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[10px] uppercase text-slate-400">Workflow</span>
                              <span className="text-foreground/80">{event.workflowName}</span>
                            </div>
                            {event.iteration && event.iteration > 1 && (
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-[10px] uppercase text-slate-400">Iteration</span>
                                <span className="text-foreground/80">{event.iteration}</span>
                              </div>
                            )}
                            {(event.outcomeBy || event.attachedBy || event.startedBy) && (
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-[10px] uppercase text-slate-400">By</span>
                                <span className="text-foreground/80">{event.outcomeBy || event.attachedBy || event.startedBy}</span>
                              </div>
                            )}
                          </div>

                          {event.type === "EVIDENCE_ATTACHED" && (
                            <div className="mt-2 p-2 bg-amber-50/50 border border-amber-100 rounded text-[11px] text-amber-800 flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              <span>Type: {event.evidenceType}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
