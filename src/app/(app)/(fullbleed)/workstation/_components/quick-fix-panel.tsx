"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, ExternalLink, AlertTriangle, Briefcase, Settings, User, ArrowRightCircle, ShieldAlert } from "lucide-react";
import type { ActionableTask } from "./task-feed";
import Link from "next/link";

interface QuickFixPanelProps {
  task: ActionableTask;
}

export function QuickFixPanel({ task }: QuickFixPanelProps) {
  // Detection logic (Slice C Diagnostics)
  // Use deterministic diagnostics from the payload
  const diag = task.diagnostics?.evidence;
  const evidenceStatus = diag?.status ?? "unknown";
  
  return (
    <Card className="h-full border-l rounded-none shadow-none bg-muted/10">
      <CardHeader className="pb-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Quick Context</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        {/* Task Info */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Task</p>
          <p className="text-sm font-semibold">{task.taskName}</p>
          <p className="text-xs text-muted-foreground">{task.workflowName}</p>
        </div>

        {/* Status Diagnostics (Slice C Diagnostics) */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status Diagnostics</p>
          <div className="p-3 rounded-md bg-background border space-y-2">
            {evidenceStatus === "present" && (
              <div className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5" />
                <p className="text-xs font-medium text-green-600">Evidence Verified</p>
              </div>
            )}

            {evidenceStatus === "missing" && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Evidence Required</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {diag?.reason || "This task requires evidence before an outcome can be recorded."}
                  </p>
                </div>
              </div>
            )}

            {evidenceStatus === "unknown" && task.evidenceRequired && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-600">Evidence Status Unknown</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Evidence may be required. Open Task Execution to confirm.
                  </p>
                </div>
              </div>
            )}

            {!task.evidenceRequired && evidenceStatus !== "present" && (
              <div className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5" />
                <p className="text-xs font-medium">Ready for Decision</p>
              </div>
            )}
            
            {task._signals?.isOverdue && (
              <div className="flex items-start gap-2 pt-1 border-t">
                <Clock className="h-3.5 w-3.5 text-destructive mt-0.5" />
                <p className="text-[10px] font-medium text-destructive">Mission Critical: Overdue</p>
              </div>
            )}
          </div>
        </div>

        {/* Next Actions (Slice E) */}
        {task.recommendations && task.recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Recommended Next Actions</p>
            <div className="grid gap-2">
              {task.recommendations.map((rec, idx) => {
                const isExternal = rec.href && !rec.href.startsWith("#");
                const icon = rec.severity === "block" ? <ShieldAlert className="h-3.5 w-3.5" /> : 
                             rec.severity === "warn" ? <AlertTriangle className="h-3.5 w-3.5" /> : 
                             <ArrowRightCircle className="h-3.5 w-3.5" />;
                
                const content = (
                  <div className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className={rec.severity === "block" ? "text-destructive" : rec.severity === "warn" ? "text-amber-600" : "text-primary"}>
                        {icon}
                      </span>
                      <span className="font-semibold">{rec.label}</span>
                      {rec.href && <ExternalLink className="ml-auto h-3 w-3 opacity-50" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 ml-5.5 leading-tight">{rec.reason}</p>
                  </div>
                );

                if (rec.href) {
                  return (
                    <Link key={idx} href={rec.href} passHref legacyBehavior>
                      <Button variant="outline" size="sm" className="w-full h-auto py-2 px-3 justify-start items-start" asChild>
                        <a>{content}</a>
                      </Button>
                    </Link>
                  );
                }

                return (
                  <Button key={idx} variant="outline" size="sm" className="w-full h-auto py-2 px-3 justify-start items-start opacity-80" disabled>
                    {content}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Links (Slice C.2 + Slice D) */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Safe Navigation</p>
          <div className="grid gap-2">
            {task.context?.jobId && (
              <Link href={`/jobs/${task.context.jobId}`} passHref legacyBehavior>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <a>
                    <Briefcase className="mr-2 h-3.5 w-3.5" />
                    Open Job Profile
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </a>
                </Button>
              </Link>
            )}

            {task.context?.customerId && (
              <Link href={`/customers/${task.context.customerId}`} passHref legacyBehavior>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <a>
                    <User className="mr-2 h-3.5 w-3.5" />
                    Open Customer
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </a>
                </Button>
              </Link>
            )}
            
            <Link href="/settings" passHref legacyBehavior>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                <a>
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  Capability Settings
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
              </Button>
            </Link>

            {!task.context?.jobId && !task.context?.customerId && (
              <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded text-center">
                Detailed context unavailable
              </p>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground italic px-1 text-center mt-2">
            Links are read-only; no truth mutations allowed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Minimal icons for internal use
function Clock({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
