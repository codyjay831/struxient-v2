import React, { useState, useMemo } from "react";
import { useManagerDashboardData, type DashboardItem, type JobHealthRow } from "../_lib/dashboard-logic";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Users, FileText, CheckCircle2, Loader2, RefreshCw, Filter, ArrowRight } from "lucide-react";

export function OverviewLens() {
  const { signalsCounts, criticalAttentionItems, timeHorizon, jobHealthRows, isLoading, error } = useManagerDashboardData();
  const [healthFilter, setHealthFilter] = useState<"all" | "red" | "orange" | "green" | "needs-decision">("all");

  const filteredJobs = useMemo(() => {
    return jobHealthRows.filter(job => {
      if (healthFilter === "all") return true;
      if (healthFilter === "needs-decision") {
        return job.health === "red" || job.health === "orange" || job.signals.unassigned;
      }
      return job.health === healthFilter;
    });
  }, [jobHealthRows, healthFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-muted-foreground animate-pulse">Computing derived signals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 border border-destructive/50 rounded-lg bg-destructive/5 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-bold text-destructive mb-2">Failed to load dashboard data</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const signals = [
    { label: "Blocked", count: signalsCounts.blocked, color: "text-red-500" },
    { label: "At Risk", count: signalsCounts.atRisk, color: "text-orange-500" },
    { label: "Waiting on Customer", count: signalsCounts.waitingOnCustomer, color: "text-blue-500" },
    { label: "Missing Evidence", count: signalsCounts.missingEvidence, color: "text-blue-500" },
    { label: "Unassigned", count: signalsCounts.unassigned, color: "text-blue-500" },
    { label: "Overdue", count: signalsCounts.overdue, color: "text-red-500" },
  ];

  const renderTimelineItem = (item: DashboardItem) => (
    <div key={item.id} className="p-3 border rounded-md bg-muted/30">
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-sm truncate pr-2">{item.task.taskName}</span>
        <Badge variant="outline" className={cn(
          "text-[10px] h-4 uppercase",
          item.severity === "CRITICAL" ? "border-red-500 text-red-500" : 
          item.severity === "AT RISK" ? "border-orange-500 text-orange-500" : ""
        )}>
          {item.category}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono mb-1">{item.jobLabel}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">{item.reason}</p>
    </div>
  );

  const renderTimelineColumn = (title: string, items: DashboardItem[]) => {
    const cappedItems = items.slice(0, 8);
    const hasMore = items.length > 8;

    return (
      <div className="space-y-4">
        <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-2 flex justify-between items-center">
          {title}
          {items.length > 0 && <span className="text-[10px] bg-muted px-1.5 rounded-sm">{items.length}</span>}
        </h3>
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No items scheduled</p>
          ) : (
            cappedItems.map(renderTimelineItem)
          )}
          {hasMore && (
            <Button variant="ghost" size="xs" className="w-full text-[10px] font-bold text-blue-500" disabled>
              + {items.length - 8} more in Tasks
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Signals Strip */}
      <div className="flex flex-wrap gap-3">
        {signals.map((signal) => (
          <div
            key={signal.label}
            className="flex items-center gap-2 px-3 py-1.5 bg-card border rounded-md"
          >
            <span className={cn("font-bold text-sm", signal.color)}>
              {signal.count}
            </span>
            <span className="text-[13px] text-muted-foreground">{signal.label}</span>
          </div>
        ))}
      </div>

      {/* Critical Attention */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold tracking-tight">
            Critical Attention ({criticalAttentionItems.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {criticalAttentionItems.slice(0, 10).map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-4 border rounded-md bg-card transition-all hover:border-border/80 flex flex-col gap-3",
                item.severity === "CRITICAL" ? "border-l-4 border-l-red-500" : "border-l-4 border-l-orange-500"
              )}
            >
              <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                <span className={item.severity === "CRITICAL" ? "text-red-500" : "text-orange-500"}>
                  {item.severity}
                </span>
                <span className="text-muted-foreground capitalize">{item.category}</span>
              </div>
              <h3 className="font-semibold text-[15px]">{item.task.taskName}</h3>
              <p className="text-xs text-muted-foreground font-mono">{item.jobLabel}</p>
              <p className="text-sm text-muted-foreground leading-snug">
                {item.reason}
              </p>
              <Button
                variant={item.severity === "CRITICAL" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "mt-auto w-full rounded-[4px] font-bold text-xs",
                  item.severity === "CRITICAL" ? "bg-blue-600 hover:bg-blue-700" : ""
                )}
                asChild
              >
                <a href={`/workstation?job=${item.task.flowGroupId}`}>
                  ({item.task.startedAt ? "opens execution" : "start task"}) {item.primaryActionLabel}
                </a>
              </Button>
            </div>
          ))}
          {/* INV-WS-01 Capped UI placeholder if needed */}
          {criticalAttentionItems.length > 10 && (
             <div className="flex items-center justify-center p-4 border border-dashed rounded-md bg-muted/20 text-center">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    +{criticalAttentionItems.length - 10} more items
                  </p>
                  <Button variant="link" className="text-blue-500 font-bold p-0 h-auto text-xs" disabled>
                    View All Critical
                  </Button>
                </div>
             </div>
          )}
          {criticalAttentionItems.length === 0 && (
            <div className="col-span-full py-10 border border-dashed rounded-md bg-muted/10 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
              <p className="font-medium">No critical blockages detected</p>
              <p className="text-sm text-muted-foreground">All systems report healthy flow.</p>
            </div>
          )}
        </div>
      </section>

      {/* Timeline Panels - INV-WS-05 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {renderTimelineColumn("Today", timeHorizon.today)}
        {renderTimelineColumn("Tomorrow", timeHorizon.tomorrow)}
        {renderTimelineColumn("This Week", timeHorizon.week)}
      </section>

      {/* Job Health at a Glance */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold tracking-tight">Job Health at a Glance</h2>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {(["all", "red", "orange", "green", "needs-decision"] as const).map((filter) => {
              const count = filter === "all" ? jobHealthRows.length : 
                           filter === "needs-decision" ? jobHealthRows.filter(j => j.health === "red" || j.health === "orange").length :
                           jobHealthRows.filter(j => j.health === filter).length;
              return (
                <Button
                  key={filter}
                  variant={healthFilter === filter ? "default" : "outline"}
                  size="xs"
                  onClick={() => setHealthFilter(filter)}
                  className={cn(
                    "rounded-full px-3 text-[11px] font-bold h-7 capitalize",
                    healthFilter === filter && filter === "red" ? "bg-red-600 hover:bg-red-700" :
                    healthFilter === filter && filter === "orange" ? "bg-orange-500 hover:bg-orange-600" :
                    healthFilter === filter && filter === "green" ? "bg-green-600 hover:bg-green-700" :
                    healthFilter === filter && filter === "needs-decision" ? "bg-blue-600 hover:bg-blue-700" : ""
                  )}
                >
                  {filter === "needs-decision" ? "Needs Decision" : filter} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        <div className="border rounded-md overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Job</th>
                  <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Stage / Door</th>
                  <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Blocking Signal</th>
                  <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Next Decision</th>
                  <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => (
                    <tr key={job.jobId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          job.health === "red" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                          job.health === "orange" ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" :
                          "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                        )} title={job.health} />
                      </td>
                      <td className="px-4 py-4 font-bold text-xs font-mono">{job.jobLabel}</td>
                      <td className="px-4 py-4 text-xs font-medium">{job.stageLabel}</td>
                      <td className="px-4 py-4">
                        {job.blockingSignal ? (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className={cn(
                              "h-3 w-3",
                              job.health === "red" ? "text-red-500" : "text-orange-500"
                            )} />
                            <span className="text-xs font-medium">{job.blockingSignal}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs italic text-muted-foreground">
                        {job.nextDecision || "Flowing naturally"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button variant="ghost" size="xs" className="h-7 w-7 p-0" asChild title="Open Job">
                          <a href={job.primaryHref}>
                            <ArrowRight className="h-4 w-4" />
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground italic">
                      No jobs match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          * Displaying active jobs with actionable work. Jobs with zero pending tasks are omitted from this view.
        </p>
      </section>
    </div>
  );
}
