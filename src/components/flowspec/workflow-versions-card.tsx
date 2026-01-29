"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2Icon,
  HistoryIcon,
  GitBranchIcon,
  AlertCircleIcon,
  EyeIcon,
} from "lucide-react";
import { ViewVersionDialog } from "./view-version-dialog";

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  snapshot: unknown;
  publishedAt: string;
  publishedBy: string;
}

interface WorkflowVersionsCardProps {
  workflowId: string;
  versions: WorkflowVersion[];
  isLoading: boolean;
  error: string | null;
}

export function WorkflowVersionsCard({
  workflowId,
  versions,
  isLoading,
  error,
}: WorkflowVersionsCardProps) {
  const router = useRouter();
  
  // Branch dialog state
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersion | null>(null);
  const [isBranching, setIsBranching] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedVersionForView, setSelectedVersionForView] = useState<WorkflowVersion | null>(null);

  const handleViewClick = (version: WorkflowVersion) => {
    setSelectedVersionForView(version);
    setViewDialogOpen(true);
  };

  const handleBranchClick = (version: WorkflowVersion) => {
    setSelectedVersion(version);
    setBranchError(null);
    setBranchDialogOpen(true);
  };

  const handleBranchConfirm = async () => {
    if (!selectedVersion) return;
    
    setIsBranching(true);
    setBranchError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/versions/${selectedVersion.id}/branch`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to create branch");
      }

      // Success - navigate to the new draft workflow
      const newWorkflowId = data.workflow?.id;
      if (newWorkflowId) {
        setBranchDialogOpen(false);
        router.push(`/flowspec/${newWorkflowId}`);
      } else {
        throw new Error("Branch created but no workflow ID returned");
      }
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setIsBranching(false);
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" />
            Versions
            {versions.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({versions.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No published versions yet. Publish the workflow to create a version.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      Version {version.version}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Published {formatDate(version.publishedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewClick(version)}
                        >
                          <EyeIcon className="size-3.5" />
                          View
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        View read-only snapshot
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBranchClick(version)}
                        >
                          <GitBranchIcon className="size-3.5" />
                          Branch
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Create a new Draft from this version
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branch Confirmation Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Branch from Version {selectedVersion?.version}</DialogTitle>
            <DialogDescription>
              This will create a new Draft workflow branched from this published version.
              You can edit the new draft independently without affecting the original.
            </DialogDescription>
          </DialogHeader>
          {branchError && (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{branchError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBranchDialogOpen(false)}
              disabled={isBranching}
            >
              Cancel
            </Button>
            <Button onClick={handleBranchConfirm} disabled={isBranching}>
              {isBranching && <Loader2Icon className="size-4 animate-spin" />}
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Version Dialog */}
      <ViewVersionDialog
        workflowId={workflowId}
        versionId={selectedVersionForView?.id || null}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </>
  );
}
