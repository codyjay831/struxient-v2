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

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TaskFeed, type ActionableTask } from "./_components/task-feed";
import { TaskExecution } from "./_components/task-execution";
import { JobHeader } from "./_components/job-header";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function WorkStationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get("job");

  const [selectedTask, setSelectedTask] = useState<ActionableTask | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Work Station</h1>
          <p className="text-muted-foreground mt-2">
            Execution surface for actionable tasks within your tenant.
          </p>
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
      <div>
        {selectedTask ? (
          <TaskExecution
            task={selectedTask}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        ) : (
          <TaskFeed
            key={`${refreshKey}-${jobId}`}
            jobId={jobId}
            onSelectTask={handleTaskSelect}
          />
        )}
      </div>
    </div>
  );
}
