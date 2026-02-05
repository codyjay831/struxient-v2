"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2Icon, 
  PlusIcon, 
  TrashIcon, 
  GitForkIcon,
  AlertCircleIcon,
  ArrowRightIcon,
} from "lucide-react";

interface FanOutRule {
  id: string;
  sourceNodeId: string;
  triggerOutcome: string;
  targetWorkflowId: string;
}

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
}

interface FanOutRulesEditorProps {
  workflowId: string;
  nodes: Node[];
  fanOutRules: FanOutRule[];
  isEditable: boolean;
  onRulesUpdated: () => void;
}

export function FanOutRulesEditor({
  workflowId,
  nodes,
  fanOutRules,
  isEditable,
  onRulesUpdated,
}: FanOutRulesEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Picker State
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  
  const [selectedSourceNodeId, setSelectedSourceNodeId] = useState("");
  const [selectedTriggerOutcome, setSelectedTriggerOutcome] = useState("");
  const [selectedTargetWorkflowId, setSelectedTargetWorkflowId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setIsLoadingWorkflows(true);
    try {
      const response = await fetch("/api/flowspec/workflows");
      const data = await response.json();
      if (response.ok) {
        // Only show PUBLISHED workflows as potential targets
        setWorkflows((data.items || []).filter((w: Workflow) => w.status === "PUBLISHED"));
      }
    } catch (err) {
      console.error("Failed to fetch workflows", err);
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleAddRule = async () => {
    if (!selectedSourceNodeId || !selectedTriggerOutcome || !selectedTargetWorkflowId) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/fan-out-rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceNodeId: selectedSourceNodeId,
            triggerOutcome: selectedTriggerOutcome,
            targetWorkflowId: selectedTargetWorkflowId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to add fan-out rule");
      }

      setIsAdding(false);
      resetPicker();
      onRulesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add fan-out rule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setIsDeleting(ruleId);
    setError(null);
    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/fan-out-rules/${ruleId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete fan-out rule");
      }

      onRulesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete fan-out rule");
    } finally {
      setIsDeleting(null);
    }
  };

  const resetPicker = () => {
    setSelectedSourceNodeId("");
    setSelectedTriggerOutcome("");
    setSelectedTargetWorkflowId("");
    setError(null);
  };

  // Get all outcomes for the selected node
  const selectedNode = nodes.find((n) => n.id === selectedSourceNodeId);
  const availableOutcomes = selectedNode
    ? Array.from(
        new Set(
          selectedNode.tasks.flatMap((t) => t.outcomes.map((o) => o.name))
        )
      ).sort()
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <GitForkIcon className="size-4" />
            Fan-Out Rules
            <span className="text-sm font-normal text-muted-foreground">
              ({fanOutRules.length})
            </span>
          </CardTitle>
          {isEditable && (
            <Button 
              size="sm" 
              onClick={() => setIsAdding(true)} 
              variant="outline"
              className="h-8"
            >
              <PlusIcon className="size-4" />
              Add Rule
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {fanOutRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 italic">
            No fan-out rules defined.
          </p>
        ) : (
          <div className="space-y-2">
            {fanOutRules.map((rule) => {
              const node = nodes.find((n) => n.id === rule.sourceNodeId);
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/30 border text-sm"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {node?.name || "Unknown Node"}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">when</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-[10px] uppercase tracking-wide">
                          {rule.triggerOutcome}
                        </span>
                      </div>
                      <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">start</span>
                        <span className="font-semibold text-foreground truncate max-w-[180px]">
                          {workflows.find((w) => w.id === rule.targetWorkflowId)?.name || `Workflow: ${rule.targetWorkflowId}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      disabled={isDeleting === rule.id}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      {isDeleting === rule.id ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <TrashIcon className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircleIcon className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      {/* Add Rule Dialog */}
      <Dialog open={isAdding} onOpenChange={(open) => {
        setIsAdding(open);
        if (!open) resetPicker();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Fan-Out Rule</DialogTitle>
            <DialogDescription>
              Trigger another workflow when a node in this workflow completes with a specific outcome.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Source Node */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Node</label>
              <select
                value={selectedSourceNodeId}
                onChange={(e) => {
                  setSelectedSourceNodeId(e.target.value);
                  setSelectedTriggerOutcome("");
                }}
                disabled={isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select node...</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Trigger Outcome */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Trigger Outcome</label>
              <select
                value={selectedTriggerOutcome}
                onChange={(e) => setSelectedTriggerOutcome(e.target.value)}
                disabled={!selectedSourceNodeId || isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select outcome...</option>
                {availableOutcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Target Workflow */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Workflow (Published)</label>
              <select
                value={selectedTargetWorkflowId}
                onChange={(e) => setSelectedTargetWorkflowId(e.target.value)}
                disabled={isLoadingWorkflows || isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select target workflow...</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {isLoadingWorkflows && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2Icon className="size-3 animate-spin" />
                  Loading workflows...
                </p>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAdding(false)} 
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRule}
              disabled={!selectedTargetWorkflowId || !selectedTriggerOutcome || isSaving}
            >
              {isSaving && <Loader2Icon className="size-4 animate-spin mr-2" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
