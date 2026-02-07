"use client";

import React, { useState, useEffect } from "react";
import { useManagerDashboardData } from "../_lib/dashboard-logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar as CalendarIcon, AlertCircle, Clock, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addHours } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type ScheduleTimeClass = 'COMMITTED' | 'PLANNED' | 'REQUESTED' | 'SUGGESTED';

interface ScheduleBlock {
  id: string;
  timeClass: ScheduleTimeClass;
  startAt: string;
  endAt: string;
  resourceId?: string;
  resourceType?: string;
  jobId?: string;
  flowId?: string;
  taskId?: string;
}

interface SchedulingSignal {
  type: "CONFLICT" | "ALERT";
  severity: "CRITICAL" | "WARNING" | "INFO";
  what: string;
  why: string;
  resolution: string;
  risk: string;
  sourceIds: string[];
}

export function CalendarLens() {
  const { lensAlerts, isLoading: dashboardLoading } = useManagerDashboardData();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [signals, setSignals] = useState<SchedulingSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [requestingBlock, setRequestingBlock] = useState<ScheduleBlock | null>(null);
  const [changeReason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [blocksRes, signalsRes] = await Promise.all([
          fetch("/api/flowspec/calendar-blocks"),
          fetch("/api/flowspec/calendar-signals")
        ]);

        if (!blocksRes.ok || !signalsRes.ok) {
          throw new Error("Failed to fetch calendar data");
        }

        const blocksData = await blocksRes.json();
        const signalsData = await signalsRes.json();

        setBlocks(blocksData.blocks || []);
        setSignals(signalsData.signals || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedule");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleRequestChange = async () => {
    if (!requestingBlock || !changeReason) return;
    
    setIsSubmitting(true);
    try {
      // Simulate requesting a 2-hour shift forward for metadata
      const currentStart = new Date(requestingBlock.startAt);
      const requestedStart = addHours(currentStart, 2);
      const requestedEnd = addHours(new Date(requestingBlock.endAt), 2);

      const response = await fetch("/api/flowspec/calendar-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: requestingBlock.taskId,
          flowId: requestingBlock.flowId,
          timeClass: requestingBlock.timeClass,
          reason: changeReason,
          metadata: {
            blockId: requestingBlock.id,
            requestedStartAt: requestedStart.toISOString(),
            requestedEndAt: requestedEnd.toISOString(),
          }
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to submit request");
      }

      // Success - reset state
      setRequestingBlock(null);
      setReason("");
      alert("Schedule change request submitted. This request will be processed via a Detour flow in Phase E2.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || dashboardLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-muted-foreground animate-pulse">Projecting calendar lens...</p>
      </div>
    );
  }

  const classStyles: Record<ScheduleTimeClass, string> = {
    COMMITTED: "border-l-4 border-l-green-600 bg-green-50/50 dark:bg-green-900/10",
    PLANNED: "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10",
    REQUESTED: "border-l-4 border-l-orange-400 bg-orange-50/50 dark:bg-orange-900/10 border-dashed",
    SUGGESTED: "border-l-4 border-l-purple-400 bg-purple-50/50 dark:bg-purple-900/10 border-dotted",
  };

  const classBadges: Record<ScheduleTimeClass, string> = {
    COMMITTED: "bg-green-600 hover:bg-green-700",
    PLANNED: "bg-blue-500 hover:bg-blue-600",
    REQUESTED: "bg-orange-400 hover:bg-orange-500",
    SUGGESTED: "bg-purple-400 hover:bg-purple-500",
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold tracking-tight">Schedule Projection (Read-Only)</h2>
        </div>
        <div className="flex flex-wrap gap-2">
           {/* Legend */}
           {(['COMMITTED', 'PLANNED', 'REQUESTED', 'SUGGESTED'] as const).map(tc => (
             <div key={tc} className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md border border-border/50">
               <div className={cn("h-2 w-2 rounded-full", tc === 'COMMITTED' ? 'bg-green-600' : tc === 'PLANNED' ? 'bg-blue-500' : tc === 'REQUESTED' ? 'bg-orange-400' : 'bg-purple-400')} />
               <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tc}</span>
             </div>
           ))}
        </div>
      </header>

      {/* Signals Overlay */}
      {signals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Schedule Signals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {signals.map((sig, idx) => (
              <Card key={idx} className={cn(
                "border-l-4",
                sig.severity === "CRITICAL" ? "border-l-red-500 bg-red-50/30 dark:bg-red-900/10" :
                sig.severity === "WARNING" ? "border-l-orange-500 bg-orange-50/30 dark:bg-orange-900/10" :
                "border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10"
              )}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold uppercase tracking-tight">{sig.what}</span>
                    <Badge variant="outline" className="text-[9px] h-4 uppercase">{sig.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{sig.why}</p>
                  <div className="text-[10px] space-y-1">
                    <p><span className="font-bold uppercase tracking-tighter text-blue-600 dark:text-blue-400">Resolution:</span> {sig.resolution}</p>
                    <p><span className="font-bold uppercase tracking-tighter text-red-600 dark:text-red-400">Risk:</span> {sig.risk}</p>
                  </div>
                  {sig.type === "CONFLICT" && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <Button 
                        variant="outline" 
                        size="xs" 
                        className="w-full text-[10px] font-bold h-7"
                        onClick={() => {
                          const sourceBlock = blocks.find(b => sig.sourceIds.includes(b.id));
                          if (sourceBlock) {
                            setRequestingBlock(sourceBlock);
                            setReason(`Resolving conflict: ${sig.what}`);
                          } else {
                            // Fallback if no specific block found
                            alert("Please select a block to reschedule manually.");
                          }
                        }}
                      >
                        Initiate Resolution Request
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col items-center py-10">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-muted/5">
           <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
           <p className="text-sm text-muted-foreground">No schedule blocks found for this company.</p>
           <p className="text-xs text-muted-foreground mt-1 italic">Schedule truth is derived from completed task outcomes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map(block => (
            <Card key={block.id} className={cn("overflow-hidden transition-all hover:shadow-md", classStyles[block.timeClass])}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <Badge className={cn("text-[10px] font-bold uppercase tracking-tighter border-none", classBadges[block.timeClass])}>
                    {block.timeClass}
                  </Badge>
                  <div className="flex gap-2">
                    <Dialog open={!!requestingBlock && requestingBlock.id === block.id} onOpenChange={(open) => !open && setRequestingBlock(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="xs" 
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-500"
                          onClick={() => setRequestingBlock(block)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Request Schedule Change</DialogTitle>
                          <DialogDescription>
                            This will create a PENDING request. Direct edits to committed blocks are prohibited.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="reason">Reason for Change</Label>
                            <Textarea 
                              id="reason" 
                              placeholder="e.g. Weather delay, resource unavailability..." 
                              value={changeReason}
                              onChange={(e) => setReason(e.target.value)}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            <strong>Note:</strong> In Phase E1, this only captures intent. New blocks will be created in Phase E2 after human confirmation.
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRequestingBlock(null)}>Cancel</Button>
                          <Button onClick={handleRequestChange} disabled={!changeReason || isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {block.jobId ? `Job: ${block.jobId.slice(0, 8)}` : 'System Block'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                   <div className="text-sm font-bold">
                     {format(new Date(block.startAt), "MMM d, h:mm a")} - {format(new Date(block.endAt), "h:mm a")}
                   </div>
                   <div className="text-xs text-muted-foreground">
                     {block.resourceType || 'Unassigned'}: {block.resourceId || '—'}
                   </div>
                </div>

                <div className="mt-2 pt-2 border-t border-border/50 flex justify-between items-center">
                   <span className="text-[10px] text-muted-foreground italic">
                     {block.timeClass === 'COMMITTED' ? 'Firm Truth' : 'Advisory / Intent'}
                   </span>
                   {block.taskId && (
                     <Button variant="link" size="xs" className="h-auto p-0 text-blue-500 font-bold text-[10px]" asChild>
                        <a href={`/workstation?lens=tasks&task=${block.taskId}&flow=${block.flowId}`}>View Task</a>
                     </Button>
                   )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
         <div className="flex gap-3">
            <Clock className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
               <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300">Phase D Restriction: Read-Only Lens</h4>
               <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-relaxed">
                 The Calendar lens is currently in read-only projection mode. While you can see all four time classes, 
                 direct drag-and-drop or manual block editing is disabled to preserve the Right Truth invariant. 
                 Schedule mutations must occur via Detour flows in Phase E.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
