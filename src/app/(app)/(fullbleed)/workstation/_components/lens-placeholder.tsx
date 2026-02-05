import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { LensAlert } from "../_lib/dashboard-logic";

interface LensPlaceholderProps {
  title: string;
  alerts: LensAlert[];
  hideEmptyState?: boolean;
}

export function LensPlaceholder({ title, alerts, hideEmptyState = false }: LensPlaceholderProps) {
  const hasAlerts = alerts.length > 0;

  if (!hasAlerts && hideEmptyState) {
    return null;
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">{title} Lens</h2>
      </div>

      {/* Proactive Alerts Section - INV-WS-03 */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          Proactive Alerts
          {alerts.length > 0 && (
            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{alerts.length}</span>
          )}
        </h3>

        {alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((alert, idx) => (
              <div 
                key={idx}
                className={cn(
                  "p-4 border rounded-md flex flex-col gap-3",
                  alert.severity === "red" ? "border-red-500/30 bg-red-500/5" :
                  alert.severity === "orange" ? "border-orange-500/30 bg-orange-500/5" :
                  "border-blue-500/30 bg-blue-500/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {alert.severity === "red" || alert.severity === "orange" ? (
                      <AlertTriangle className={cn("h-4 w-4", alert.severity === "red" ? "text-red-500" : "text-orange-500")} />
                    ) : (
                      <Info className="h-4 w-4 text-blue-500" />
                    )}
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider",
                      alert.severity === "red" ? "text-red-500" :
                      alert.severity === "orange" ? "text-orange-500" :
                      "text-blue-500"
                    )}>
                      {alert.title}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-secondary-foreground font-medium">
                  {alert.body}
                </p>
                <Button 
                  size="sm" 
                  className="w-fit font-bold bg-blue-600 hover:bg-blue-700 rounded-[4px] text-xs h-8"
                  asChild
                >
                  <a href={alert.primaryHref || "#"}>
                    {alert.primaryActionLabel}
                  </a>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 border border-dashed rounded-md bg-green-500/5 border-green-500/30 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              All clear. No proactive alerts for this lens.
            </span>
          </div>
        )}
      </section>

      {/* Visual Placeholder Grid */}
      <div className="h-[400px] border border-dashed rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground flex-col gap-2">
        <p className="text-sm font-medium">{title} Visual Grid Mock</p>
        <p className="text-xs">Phase 3 Lens Data Placeholder</p>
      </div>
    </div>
  );
}
