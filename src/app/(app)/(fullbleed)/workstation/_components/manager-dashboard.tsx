"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { OverviewLens } from "./overview-lens";
import { LensPlaceholder } from "./lens-placeholder";
import { DashboardRightRail } from "./dashboard-right-rail";
import { TaskFeed, type ActionableTask } from "./task-feed";
import { TaskExecution } from "./task-execution";
import { JobHeader } from "./job-header";
import { QuickFixPanel } from "./quick-fix-panel";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, Filter } from "lucide-react";
import { useManagerDashboardData, type LensType } from "../_lib/dashboard-logic";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ManagerDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const lensFromUrl = searchParams.get("lens") as LensType | null;
  const jobIdFromUrl = searchParams.get("job");
  
  const initialLens: LensType = lensFromUrl && ["overview", "calendar", "jobs", "tasks", "crews", "analytics"].includes(lensFromUrl) 
    ? lensFromUrl 
    : jobIdFromUrl ? "jobs" : "overview";

  const [activeLens, setActiveLens] = useState<LensType>(initialLens);
  const [selectedTask, setSelectedTask] = useState<ActionableTask | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const { lensAlerts, isLoading, error } = useManagerDashboardData();

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

  // Sync state with URL
  useEffect(() => {
    if (lensFromUrl && ["overview", "calendar", "jobs", "tasks", "crews", "analytics"].includes(lensFromUrl)) {
      setActiveLens(lensFromUrl);
    } else if (jobIdFromUrl && !lensFromUrl) {
      setActiveLens("jobs");
    }
  }, [lensFromUrl, jobIdFromUrl]);

  const handleLensChange = (lens: LensType) => {
    setActiveLens(lens);
    setSelectedTask(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lens", lens);
    // When changing lens, we usually want to clear the job focus unless we are in the jobs lens
    if (lens !== "jobs" && lens !== "tasks") {
      params.delete("job");
    }
    router.push(`/workstation?${params.toString()}`);
  };

  const handleClearJob = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("job");
    router.push(`/workstation?${params.toString()}`);
  };

  const handleTaskSelect = (task: ActionableTask) => {
    setSelectedTask(task);
  };

  const handleBackToFeed = () => {
    setSelectedTask(null);
  };

  const tabs: { id: LensType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "calendar", label: "Calendar" },
    { id: "jobs", label: "Jobs" },
    { id: "tasks", label: "Tasks" },
    { id: "crews", label: "Crews & Employees" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Work Station Header inside page content */}
        <header className="px-8 pt-8 pb-4 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Work Station</h1>
              <p className="text-sm text-muted-foreground">
                Decision & execution hub for actionable work
              </p>
            </div>
            <div className="flex items-center gap-4">
              {activeLens === "tasks" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={assignmentFilter ? "default" : "outline"}
                        size="xs"
                        onClick={() => setAssignmentFilter(!assignmentFilter)}
                        className="h-7 text-[11px] font-bold uppercase"
                      >
                        <Filter className="mr-2 h-3 w-3" />
                        {assignmentFilter ? "My Assignments" : "All Tasks"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px]">
                      <p className="text-xs">
                        View filter only. This narrows your view to tasks where you are assigned but does not affect your ability to execute any task.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="px-3 py-1 bg-muted rounded-full text-[11px] font-bold uppercase border border-border tracking-wider text-muted-foreground">
                Manager View
              </div>
              <button className="text-[11px] font-medium text-muted-foreground underline decoration-muted-foreground/30 hover:text-foreground">
                Switch to Owner
              </button>
            </div>
          </div>

          {/* Lens Tabs - INV-WS-03 */}
          <nav className="flex gap-8 border-b border-border/60">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleLensChange(tab.id)}
                className={cn(
                  "pb-3 text-sm font-medium transition-all relative",
                  activeLens === tab.id
                    ? "text-blue-500 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-blue-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-background">
          {selectedTask ? (
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBackToFeed}
                  className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to {jobIdFromUrl ? "Job" : "Tasks"}
                </Button>
                <TaskExecution
                  task={selectedTask}
                  onBack={handleBackToFeed}
                  onComplete={() => {
                    setSelectedTask(null);
                    // Force refresh of dashboard data could be handled by a context or just letting the hook re-run
                  }}
                />
              </div>
              <div className="w-full md:w-80 flex-shrink-0">
                <QuickFixPanel task={selectedTask} />
              </div>
            </div>
          ) : (
            <>
              {activeLens === "overview" && <OverviewLens />}
              {activeLens === "calendar" && (
                <LensPlaceholder
                  title="Calendar"
                  alerts={lensAlerts.calendar}
                />
              )}
              {activeLens === "jobs" && (
                <div className="space-y-6">
                  {lensAlerts.jobs.length > 0 && (
                    <LensPlaceholder
                      title="Jobs"
                      alerts={lensAlerts.jobs}
                      hideEmptyState
                    />
                  )}
                  {jobIdFromUrl && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Job Focus</h2>
                        <Button variant="ghost" size="xs" onClick={handleClearJob}>
                          <X className="mr-2 h-3.5 w-3.5" />
                          Clear Focus
                        </Button>
                      </div>
                      <JobHeader flowGroupId={jobIdFromUrl} />
                    </div>
                  )}
                  <TaskFeed
                    jobId={jobIdFromUrl}
                    onSelectTask={handleTaskSelect}
                    assignmentFilter={assignmentFilter}
                    currentMemberId={currentMemberId}
                  />
                </div>
              )}
              {activeLens === "tasks" && (
                <div className="space-y-6">
                  {lensAlerts.tasks.length > 0 && (
                    <LensPlaceholder
                      title="Tasks"
                      alerts={lensAlerts.tasks}
                      hideEmptyState
                    />
                  )}
                  <TaskFeed
                    onSelectTask={handleTaskSelect}
                    assignmentFilter={assignmentFilter}
                    currentMemberId={currentMemberId}
                  />
                </div>
              )}
              {activeLens === "crews" && (
                <LensPlaceholder
                  title="Crews & Employees"
                  alerts={lensAlerts.crews}
                />
              )}
              {activeLens === "analytics" && (
                <LensPlaceholder
                  title="Analytics"
                  alerts={lensAlerts.analytics}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Rail - INV-WS-04 */}
      <DashboardRightRail />
    </div>
  );
}
