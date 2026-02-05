"use client";

/**
 * Work Station - Post-login landing page
 * 
 * Canon Source: 10_workstation_contract.md
 * - §3: Work Station IS an Execution Surface
 * - §4.1: MUST query, render, collect, submit, handle rejections, refresh
 * 
 * NEW: Manager Dashboard v1 is now the sole authoritative entry point.
 * Integrated Task Feed and Execution surfaces live within the dashboard.
 */

import { ManagerDashboard } from "./_components/manager-dashboard";

export default function WorkStationPage() {
  return (
    <div className="h-full bg-background flex flex-col">
       <ManagerDashboard />
    </div>
  );
}
