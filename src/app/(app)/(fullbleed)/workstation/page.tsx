"use client";

/**
 * Work Station - Post-login landing page
 * 
 * Canon Source: 10_workstation_contract.md
 * - §3: Work Station IS an Execution Surface
 * - §4.1: MUST query, render, collect, submit, handle rejections, refresh
 * 
 * WS-INV-007: Refresh After Submission
 * 
 * Boundary: All components are in _components/ directory within guard scope.
 * No imports from @/lib/flowspec/engine, derived, or truth.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TaskFeed, type ActionableTask } from "./_components/task-feed";
import { TaskExecution } from "./_components/task-execution";
import { QuickFixPanel } from "./_components/quick-fix-panel";
import { JobHeader } from "./_components/job-header";
import { Button } from "@/components/ui/button";
import { X, Filter, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function WorkStationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get("job");

  const [selectedTask, setSelectedTask] = useState<ActionableTask | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignmentFilter, setAssignmentFilter] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // Fetch current member context for filtering
  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/tenancy/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentMemberId(data.memberId);
        }
      } catch (err) {
        console.error("Failed to fetch member context", err);
      }
    }
    fetchMe();
  }, []);

  const handleTaskSelect = useCallback((task: ActionableTask) => {
    setSelectedTask(task);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedTask(null);
  }, []);

  // WS-INV-007: Refresh after successful outcome submission
  const handleComplete = useCallback(() => {
    setSelectedTask(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const clearJobFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("job");
    router.push(`/workstation?${params.toString()}`);
  }, [router, searchParams]);

  const toggleAssignmentFilter = useCallback(() => {
    setAssignmentFilter((prev) => !prev);
  }, []);

  const clearAssignmentFilter = useCallback(() => {
    setAssignmentFilter(false);
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Work Station</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Execution surface for actionable tasks within your tenant.
              </p>
            </div>

            {!selectedTask && (
              <div className="flex items-center gap-2">
                {assignmentFilter && (
                  <Button 
                    variant="outline" 
                    size="compact" 
                    onClick={clearAssignmentFilter}
                    className="animate-in fade-in slide-in-from-right-2"
                  >
                    Show All Tasks
                  </Button>
                )}
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={assignmentFilter ? "default" : "outline"}
                        size="compact"
                        onClick={toggleAssignmentFilter}
                      >
                        <Filter className="mr-2 h-3.5 w-3.5" />
                        Filter: My Assignments
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px]">
                      <p className="text-xs">
                        View filter only. This narrows your view to tasks where you are assigned but does not affect your ability to execute any task.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

        {jobId && !selectedTask && (
          <div className="space-y-4">
            <JobHeader flowGroupId={jobId} />
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="flex-1">
                <p className="text-sm font-medium">Filtered by Job</p>
                <p className="text-xs text-muted-foreground font-mono">{jobId}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearJobFilter}>
                <X className="mr-2 h-4 w-4" />
                All Tasks
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-h-[600px]">
        {selectedTask ? (
          <div className="flex flex-col md:flex-row gap-0 border rounded-xl overflow-hidden shadow-sm bg-card">
            <div className="flex-1 p-6 overflow-y-auto max-h-[800px]">
              <TaskExecution
                task={selectedTask}
                onBack={handleBack}
                onComplete={handleComplete}
              />
            </div>
            <div className="w-full md:w-72 flex-shrink-0">
              <QuickFixPanel task={selectedTask} />
            </div>
          </div>
        ) : (
          <TaskFeed
            key={`${refreshKey}-${jobId}`}
            jobId={jobId}
            onSelectTask={handleTaskSelect}
            assignmentFilter={assignmentFilter}
            currentMemberId={currentMemberId}
          />
        )}
      </div>
    </div>
  );
}
