"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2Icon, AlertCircleIcon, EyeIcon } from "lucide-react";
import { WorkflowVersion } from "./workflow-versions-card";

interface ViewVersionDialogProps {
  workflowId: string;
  versionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewVersionDialog({
  workflowId,
  versionId,
  open,
  onOpenChange,
}: ViewVersionDialogProps) {
  const [version, setVersion] = useState<WorkflowVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && versionId) {
      fetchVersion();
    } else {
      // Clear state when closed
      if (!open) {
        setVersion(null);
        setError(null);
      }
    }
  }, [open, versionId]);

  const fetchVersion = async () => {
    if (!versionId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/versions/${versionId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch version details");
      }

      setVersion(data.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch version details");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeIcon className="size-5" />
            View Version {version?.version || ""}
          </DialogTitle>
          <DialogDescription>
            Read-only snapshot of the workflow at the time of publication.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading version snapshot...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : version ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm border p-3 rounded-md bg-muted/30">
                <div>
                  <span className="text-muted-foreground block">Published At</span>
                  <span className="font-medium">{formatDate(version.publishedAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Published By</span>
                  <span className="font-medium">{version.publishedBy}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Workflow Snapshot</h4>
                <div className="rounded-md border bg-slate-950 p-4 overflow-auto max-h-[400px]">
                  <pre className="text-[11px] leading-relaxed text-slate-50 font-mono whitespace-pre-wrap">
                    {JSON.stringify(version.snapshot, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
