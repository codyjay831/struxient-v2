"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2Icon,
  SaveIcon,
  TrashIcon,
  FlagIcon,
  SettingsIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { TaskListPanel } from "./task-list-panel";

export type CompletionRule = "ALL_TASKS_DONE" | "ANY_TASK_DONE" | "SPECIFIC_TASKS_DONE";

interface Outcome {
  id: string;
  name: string;
}

interface CrossFlowDependency {
  id: string;
  sourceWorkflowId: string;
  sourceTaskPath: string;
  requiredOutcome: string;
}

interface Task {
  id: string;
  name: string;
  instructions: string | null;
  displayOrder: number;
  evidenceRequired?: boolean;
  evidenceSchema?: any | null;
  outcomes: Outcome[];
  crossFlowDependencies: CrossFlowDependency[];
}

interface Node {
  id: string;
  name: string;
  isEntry: boolean;
  completionRule: CompletionRule;
  tasks: Task[];
}

interface Gate {
  id: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null;
}

interface NodeDetailPanelProps {
  workflowId: string;
  node: Node;
  nodes: Node[];
  gates: Gate[];
  isEditable: boolean;
  isLastEntryNode: boolean;
  onNodeUpdated: () => void;
  onNodeDeleted: () => void;
  // Highlight props for validation navigation
  highlightTaskId?: string;
  highlightOutcome?: { taskId?: string; outcomeName?: string };
}

const completionRuleLabels: Record<CompletionRule, string> = {
  ALL_TASKS_DONE: "All Tasks Done",
  ANY_TASK_DONE: "Any Task Done",
  SPECIFIC_TASKS_DONE: "Specific Tasks Done",
};

export function NodeDetailPanel({
  workflowId,
  node,
  nodes,
  gates,
  isEditable,
  isLastEntryNode,
  onNodeUpdated,
  onNodeDeleted,
  highlightTaskId,
  highlightOutcome,
}: NodeDetailPanelProps) {
  // Form state
  const [name, setName] = useState(node.name);
  const [isEntry, setIsEntry] = useState(node.isEntry);
  const [completionRule, setCompletionRule] = useState<CompletionRule>(
    node.completionRule as CompletionRule
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Clear form when node changes
  useEffect(() => {
    setName(node.name);
    setIsEntry(node.isEntry);
    setCompletionRule(node.completionRule as CompletionRule);
    setHasChanges(false);
    setSaveError(null);
  }, [node.id, node.name, node.isEntry, node.completionRule]);

  // Track changes
  useEffect(() => {
    const changed =
      name !== node.name ||
      isEntry !== node.isEntry ||
      completionRule !== node.completionRule;
    setHasChanges(changed);
  }, [name, isEntry, completionRule, node.name, node.isEntry, node.completionRule]);

  // Check if we can toggle off entry
  const canToggleEntryOff = !isLastEntryNode || !node.isEntry;

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name !== node.name ? name : undefined,
            isEntry: isEntry !== node.isEntry ? isEntry : undefined,
            completionRule: completionRule !== node.completionRule ? completionRule : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error?.message || "Failed to save changes");
        return;
      }

      onNodeUpdated();
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${node.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error?.message || "Failed to delete node");
        return;
      }

      setDeleteDialogOpen(false);
      onNodeDeleted();
    } catch {
      setDeleteError("Failed to delete node. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEntryToggle = (checked: boolean) => {
    // Prevent unchecking if this is the last entry node
    if (!checked && isLastEntryNode && node.isEntry) {
      return;
    }
    setIsEntry(checked);
  };

  return (
    <div className="space-y-4" data-density="compact">
      {/* Node Properties */}
      <Card variant="compact">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="size-3" />
            <Label variant="metadata">Node Properties</Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Name */}
          <div className="space-y-1">
            <Label variant="metadata" htmlFor="node-name">
              Name
            </Label>
            <Input
              id="node-name"
              size="compact"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditable || isSaving}
              placeholder="Node name"
            />
          </div>

          {/* Is Entry */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="node-is-entry"
                checked={isEntry}
                onChange={(e) => handleEntryToggle(e.target.checked)}
                disabled={!isEditable || isSaving || (!canToggleEntryOff && isEntry)}
                className="h-3.5 w-3.5 rounded border-input bg-background accent-primary"
              />
              <Label htmlFor="node-is-entry" className="flex items-center gap-1">
                <FlagIcon className="size-3 text-green-600" />
                Entry Node
              </Label>
            </div>
            {!canToggleEntryOff && node.isEntry && (
              <p className="text-[10px] text-muted-foreground leading-tight">
                Cannot remove entry status — at least one entry node is required.
              </p>
            )}
          </div>

          {/* Completion Rule */}
          <div className="space-y-1">
            <Label variant="metadata" htmlFor="completion-rule">
              Completion Rule
            </Label>
            <select
              id="completion-rule"
              value={completionRule}
              onChange={(e) => setCompletionRule(e.target.value as CompletionRule)}
              disabled={!isEditable || isSaving}
              className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Object.entries(completionRuleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Error Display */}
          {saveError && (
            <div className="flex items-center gap-2 p-1.5 rounded-md bg-destructive/10 text-destructive text-[10px]">
              <AlertCircleIcon className="size-3 shrink-0" />
              {saveError}
            </div>
          )}

          {/* Actions */}
          {isEditable && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="destructive"
                size="compact"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isSaving || (isLastEntryNode && node.isEntry)}
                className="h-7 text-[10px]"
              >
                <TrashIcon className="size-3" />
                Delete Node
              </Button>
              <Button
                size="compact"
                onClick={handleSave}
                disabled={!hasChanges || isSaving || !name.trim()}
                className="h-7 text-[10px]"
              >
                {isSaving ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <SaveIcon className="size-3" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {isLastEntryNode && node.isEntry && isEditable && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This is the only entry node. Add another entry node before deleting this one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tasks List with CRUD */}
      <TaskListPanel
        workflowId={workflowId}
        nodeId={node.id}
        nodeName={node.name}
        tasks={node.tasks}
        nodes={nodes}
        gates={gates}
        isEditable={isEditable}
        onTasksUpdated={onNodeUpdated}
        highlightTaskId={highlightTaskId}
        highlightOutcome={highlightOutcome}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{node.name}"? This will also delete all
              tasks and outcomes within this node. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircleIcon className="size-4" />
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2Icon className="size-4 animate-spin" />}
              Delete Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
