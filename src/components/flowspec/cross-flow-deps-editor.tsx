"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  LinkIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
} from "lucide-react";

interface Outcome {
  id: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
  outcomes: Outcome[];
}

interface Node {
  id: string;
  name: string;
  tasks: Task[];
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  nodes?: Node[];
}

interface CrossFlowDependency {
  id: string;
  sourceWorkflowId: string;
  sourceTaskPath: string;
  requiredOutcome: string;
}

interface CrossFlowDepsEditorProps {
  workflowId: string;
  nodeId: string;
  taskId: string;
  isEditable: boolean;
  dependencies: CrossFlowDependency[];
  onDependenciesUpdated: () => void;
}

export function CrossFlowDepsEditor({
  workflowId,
  nodeId,
  taskId,
  isEditable,
  dependencies,
  onDependenciesUpdated,
}: CrossFlowDepsEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Picker State
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [selectedSourceWorkflowId, setSelectedSourceWorkflowId] = useState("");
  const [sourceWorkflowDetail, setSourceWorkflowDetail] = useState<Workflow | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  const [selectedSourceNodeId, setSelectedSourceNodeId] = useState("");
  const [selectedSourceTaskId, setSelectedSourceTaskId] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setIsLoadingWorkflows(true);
    try {
      const response = await fetch("/api/flowspec/workflows");
      const data = await response.json();
      if (response.ok) {
        // Only show PUBLISHED workflows as potential sources
        setWorkflows((data.items || []).filter((w: Workflow) => w.status === "PUBLISHED"));
      }
    } catch (err) {
      console.error("Failed to fetch workflows", err);
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, []);

  useEffect(() => {
    if (isAdding) {
      fetchWorkflows();
    }
  }, [isAdding, fetchWorkflows]);

  useEffect(() => {
    if (selectedSourceWorkflowId) {
      const fetchDetail = async () => {
        setIsLoadingDetail(true);
        try {
          const response = await fetch(`/api/flowspec/workflows/${selectedSourceWorkflowId}`);
          const data = await response.json();
          if (response.ok) {
            setSourceWorkflowDetail(data.workflow);
          }
        } catch (err) {
          console.error("Failed to fetch workflow detail", err);
        } finally {
          setIsLoadingDetail(false);
        }
      };
      fetchDetail();
    } else {
      setSourceWorkflowDetail(null);
      setSelectedSourceNodeId("");
      setSelectedSourceTaskId("");
      setSelectedOutcome("");
    }
  }, [selectedSourceWorkflowId]);

  const handleAddDependency = async () => {
    if (!selectedSourceWorkflowId || !selectedSourceNodeId || !selectedSourceTaskId || !selectedOutcome) return;

    setIsSaving(true);
    setError(null);
    try {
      const sourceTaskPath = `${selectedSourceNodeId}.${selectedSourceTaskId}`;
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/cross-flow-dependencies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceWorkflowId: selectedSourceWorkflowId,
            sourceTaskPath,
            requiredOutcome: selectedOutcome,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to add dependency");
      }

      setIsAdding(false);
      setSelectedSourceWorkflowId("");
      onDependenciesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dependency");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDependency = async (depId: string) => {
    setIsDeleting(depId);
    setError(null);
    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/cross-flow-dependencies/${depId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete dependency");
      }

      onDependenciesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dependency");
    } finally {
      setIsDeleting(null);
    }
  };

  const selectedNode = sourceWorkflowDetail?.nodes?.find(n => n.id === selectedSourceNodeId);
  const selectedTask = selectedNode?.tasks?.find(t => t.id === selectedSourceTaskId);

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <LinkIcon className="size-4" />
          Cross-Flow Dependencies
        </h3>
        {isEditable && (
          <Button size="xs" onClick={() => setIsAdding(true)} variant="outline" className="h-7 text-xs">
            <PlusIcon className="size-3 mr-1" />
            Add Dependency
          </Button>
        )}
      </div>

      {dependencies.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No cross-flow dependencies defined.</p>
      ) : (
        <div className="space-y-2">
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30 border text-xs"
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-medium truncate">
                  Source Workflow: <span className="text-muted-foreground font-normal">{dep.sourceWorkflowId}</span>
                </p>
                <p className="truncate">
                  Task Path: <span className="text-muted-foreground">{dep.sourceTaskPath}</span>
                </p>
                <p className="truncate">
                  Requires: <span className="text-blue-600 dark:text-blue-400 font-medium">{dep.requiredOutcome}</span>
                </p>
              </div>
              {isEditable && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDeleteDependency(dep.id)}
                  disabled={isDeleting === dep.id}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  {isDeleting === dep.id ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <TrashIcon className="size-3" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Add Dependency Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Cross-Flow Dependency</DialogTitle>
            <DialogDescription>
              Wait for an outcome in another workflow before this task becomes actionable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Workflow */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Workflow</label>
              <select
                value={selectedSourceWorkflowId}
                onChange={(e) => setSelectedSourceWorkflowId(e.target.value)}
                disabled={isLoadingWorkflows || isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select a published workflow...</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (v{w.id.slice(-4)})
                  </option>
                ))}
              </select>
              {isLoadingWorkflows && <p className="text-[10px] text-muted-foreground">Loading workflows...</p>}
            </div>

            {/* Step 2: Node & Task */}
            {selectedSourceWorkflowId && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Node</label>
                  <select
                    value={selectedSourceNodeId}
                    onChange={(e) => {
                      setSelectedSourceNodeId(e.target.value);
                      setSelectedSourceTaskId("");
                      setSelectedOutcome("");
                    }}
                    disabled={isLoadingDetail || isSaving}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select node...</option>
                    {sourceWorkflowDetail?.nodes?.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Task</label>
                  <select
                    value={selectedSourceTaskId}
                    onChange={(e) => {
                      setSelectedSourceTaskId(e.target.value);
                      setSelectedOutcome("");
                    }}
                    disabled={!selectedSourceNodeId || isSaving}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select task...</option>
                    {selectedNode?.tasks?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Outcome */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Required Outcome</label>
                  <select
                    value={selectedOutcome}
                    onChange={(e) => setSelectedOutcome(e.target.value)}
                    disabled={!selectedSourceTaskId || isSaving}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select outcome...</option>
                    {selectedTask?.outcomes?.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleAddDependency}
              disabled={!selectedOutcome || isSaving}
            >
              {isSaving && <Loader2Icon className="size-4 animate-spin mr-2" />}
              Add Dependency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
