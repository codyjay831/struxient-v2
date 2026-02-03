"use client";

/**
 * Task Feed Component
 * 
 * Canon Source: 10_workstation_contract.md §4.1.1, §4.1.2
 * - §4.1.1: Query Actionable Tasks from FlowSpec
 * - §4.1.2: Render Tasks in a user-friendly interface
 * 
 * Boundary: Uses API only, no direct FlowSpec engine imports.
 *
 * INVARIANT: Canonical ordering unchanged (flowId ASC → taskId ASC → iteration ASC)
 * Signal chips are READ-ONLY enrichment; they do NOT affect task order.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertCircle, Briefcase, UserCircle, Clock, AlertTriangle, Zap, LayoutGrid } from "lucide-react";
import { applyAllFilters, type SignalFilters, type TaskView } from "../_lib/filter-logic";
import { TaskSignalSummary } from "./task-signal-summary";
import { TaskViewSelector } from "./task-view-selector";

export interface TaskSignals {
  jobPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  effectiveSlaHours: number | null;
  effectiveDueAt: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface ActionableTask {
  flowId: string;
  flowGroupId: string;
  workflowId: string;
  workflowName: string;
  taskId: string;
  taskName: string;
  nodeId: string;
  nodeName: string;
  instructions: string | null;
  allowedOutcomes: string[];
  evidenceRequired: boolean;
  evidenceSchema: { type?: string; description?: string } | null;
  domainHint: "execution" | "finance" | "sales";
  startedAt: string | null;
  _metadata?: {
    assignments: Array<{
      slotKey: string;
      assigneeType: 'PERSON' | 'EXTERNAL';
      assignee: {
        id: string;
        name?: string;
        userId?: string;
        role?: string;
      }
    }>
  };
  _signals?: TaskSignals;
  diagnostics?: {
    evidence?: {
      required: boolean;
      status: "missing" | "present" | "unknown";
      reason?: string;
    };
  };
  context?: {
    jobId?: string;
    customerId?: string;
  };
  recommendations?: Array<{
    kind: "open_task" | "open_job" | "open_customer" | "open_settings";
    label: string;
    href?: string;
    reason: string;
    severity?: "info" | "warn" | "block";
  }>;
}

interface TaskFeedProps {
  onSelectTask: (task: ActionableTask) => void;
  jobId?: string | null;
  assignmentFilter?: boolean;
  currentMemberId?: string | null;
}

export function TaskFeed({ onSelectTask, jobId, assignmentFilter, currentMemberId }: TaskFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<ActionableTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Signal filters (client-side only, no reordering)
  const [signalFilters, setSignalFilters] = useState<SignalFilters>({
    showOverdueOnly: false,
    showHighPriorityOnly: false,
    view: "all",
  });

  const setView = (view: TaskView) => {
    setSignalFilters(f => ({ ...f, view }));
  };

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = jobId
        ? `/api/flowspec/flow-groups/${jobId}/actionable-tasks`
        : "/api/flowspec/actionable-tasks";
        
      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch tasks");
      }
      const data = await response.json();
      setTasks(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // OPTION_A_SPEC #10: Client-side matching logic
  // INVARIANT: Filtering never changes canonical order
  const filteredTasks = useMemo(() => {
    return applyAllFilters(tasks, !!assignmentFilter, currentMemberId || null, signalFilters);
  }, [tasks, assignmentFilter, currentMemberId, signalFilters]);

  // Toggle signal filters
  const toggleOverdueFilter = () => {
    setSignalFilters(f => ({ ...f, showOverdueOnly: !f.showOverdueOnly }));
  };
  const togglePriorityFilter = () => {
    setSignalFilters(f => ({ ...f, showHighPriorityOnly: !f.showHighPriorityOnly }));
  };

  const handleViewJob = (e: React.MouseEvent, flowGroupId: string) => {
    e.stopPropagation();
    const params = new URLSearchParams(searchParams.toString());
    params.set("job", flowGroupId);
    router.push(`/workstation?${params.toString()}`);
  };

  // Loading state
  if (isLoading && tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading actionable tasks...</p>
        </CardContent>
      </Card>
    );
  }

  // Error state (Canon §4.1.6: Handle Rejections gracefully)
  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="mt-4 font-medium text-destructive">Error loading tasks</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={fetchTasks}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Actionable Tasks</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchTasks} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              {jobId ? "No actionable tasks for this job right now." : "No actionable tasks right now."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {jobId 
                ? "This job might be waiting on a pre-condition or manual milestone."
                : "Tasks will appear here when FlowSpec surfaces work for you."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Task list
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ready for Work ({tasks.length})</h2>
          <Button variant="ghost" size="sm" onClick={fetchTasks} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* View Selector - Slice B */}
        <TaskViewSelector 
          currentView={signalFilters.view || "all"} 
          onViewChange={setView} 
        />

        {/* Signal Summary Header - Slice A */}
        <TaskSignalSummary 
          tasks={tasks}
          filters={signalFilters}
          onToggleOverdue={toggleOverdueFilter}
          onTogglePriority={togglePriorityFilter}
          onViewChange={setView}
          onClearFilters={() => setSignalFilters({ showOverdueOnly: false, showHighPriorityOnly: false, view: "all" })}
        />
        
        {/* OPTION_A_SPEC #4: Indicator */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredTasks.length} {filteredTasks.length !== tasks.length ? "filtered" : ""} tasks of {tasks.length} total actionable
        </p>
      </div>

      <div className="grid gap-3">
        {filteredTasks.length === 0 ? (
          <Card className="bg-muted/20 border-dashed">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <UserCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-muted-foreground">No tasks assigned to you</p>
              <p className="text-sm text-muted-foreground mt-1">
                Toggle "Filter: My Assignments" off to see all actionable work.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={`${task.flowId}-${task.taskId}`}
              className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              onClick={() => onSelectTask(task)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">{task.taskName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {task.domainHint}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {task.workflowName} • {task.nodeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Job: {task.flowGroupId.slice(0, 8)}...
                    </p>

                    {/* OPTION_A_SPEC #7 & #8: Assignment Badges */}
                    {task._metadata?.assignments && task._metadata.assignments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {task._metadata.assignments.map((a, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className={`text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground border-muted-foreground/30 ${
                              a.assigneeType === 'EXTERNAL' ? 'border-dashed' : ''
                            }`}
                          >
                            {a.assigneeType === 'EXTERNAL' ? 'EXT: ' : ''}
                            {a.slotKey}: {a.assignee.name || a.assignee.userId || a.assignee.id}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {/* Signal Chips - READ-ONLY display, no reordering */}
                    <div className="flex flex-wrap gap-1 justify-end">
                      {task._signals?.isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Overdue
                        </Badge>
                      )}
                      {task._signals?.isDueSoon && !task._signals?.isOverdue && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="mr-1 h-3 w-3" />
                          Due Soon
                        </Badge>
                      )}
                      {task._signals?.jobPriority === "URGENT" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">
                          <Zap className="mr-1 h-3 w-3" />
                          Urgent
                        </Badge>
                      )}
                      {task._signals?.jobPriority === "HIGH" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200">
                          <Zap className="mr-1 h-3 w-3" />
                          High
                        </Badge>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {task.startedAt ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                          Ready
                        </Badge>
                      )}
                    </div>
                    {!jobId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => handleViewJob(e, task.flowGroupId)}
                      >
                        <Briefcase className="mr-1 h-3 w-3" />
                        Focus Job
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// Export refresh function for parent to call after outcome submission
export function useTaskFeedRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { refreshKey, triggerRefresh };
}
