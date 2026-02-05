"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { OverviewLens } from "./overview-lens";
import { LensPlaceholder } from "./lens-placeholder";
import { DashboardRightRail } from "./dashboard-right-rail";
import { useManagerDashboardData, type LensType } from "../_lib/dashboard-logic";

export function ManagerDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const lensFromUrl = searchParams.get("lens") as LensType | null;
  const initialLens: LensType = lensFromUrl && ["overview", "calendar", "jobs", "tasks", "crews", "analytics"].includes(lensFromUrl) 
    ? lensFromUrl 
    : "overview";

  const [activeLens, setActiveLens] = useState<LensType>(initialLens);
  const { lensAlerts, isLoading, error } = useManagerDashboardData();

  // Sync state with URL when URL changes (e.g. from alert links)
  useEffect(() => {
    if (lensFromUrl && ["overview", "calendar", "jobs", "tasks", "crews", "analytics"].includes(lensFromUrl)) {
      setActiveLens(lensFromUrl);
    }
  }, [lensFromUrl]);

  const handleLensChange = (lens: LensType) => {
    setActiveLens(lens);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lens", lens);
    router.push(`/workstation?${params.toString()}`);
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
          {activeLens === "overview" && <OverviewLens />}
          {activeLens === "calendar" && (
            <LensPlaceholder
              title="Calendar"
              alerts={lensAlerts.calendar}
            />
          )}
          {activeLens === "jobs" && (
            <LensPlaceholder
              title="Jobs"
              alerts={lensAlerts.jobs}
            />
          )}
          {activeLens === "tasks" && (
            <LensPlaceholder
              title="Tasks"
              alerts={lensAlerts.tasks}
            />
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
        </div>
      </div>

      {/* Right Rail - INV-WS-04 */}
      <DashboardRightRail />
    </div>
  );
}
