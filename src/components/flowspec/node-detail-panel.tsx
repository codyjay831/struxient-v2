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
    <div className="space-y-4">
      {/* Node Properties */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="size-4" />
            Node Properties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="node-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="node-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditable || isSaving}
              placeholder="Node name"
            />
          </div>

          {/* Is Entry */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="node-is-entry"
                checked={isEntry}
                onChange={(e) => handleEntryToggle(e.target.checked)}
                disabled={!isEditable || isSaving || (!canToggleEntryOff && isEntry)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="node-is-entry" className="text-sm flex items-center gap-1">
                <FlagIcon className="size-3 text-green-600" />
                Entry Node
              </label>
            </div>
            {!canToggleEntryOff && node.isEntry && (
              <p className="text-xs text-muted-foreground">
                Cannot remove entry status — at least one entry node is required.
              </p>
            )}
          </div>

          {/* Completion Rule */}
          <div className="space-y-2">
            <label htmlFor="completion-rule" className="text-sm font-medium">
              Completion Rule
            </label>
            <select
              id="completion-rule"
              value={completionRule}
              onChange={(e) => setCompletionRule(e.target.value as CompletionRule)}
              disabled={!isEditable || isSaving}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Object.entries(completionRuleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {completionRule === "ALL_TASKS_DONE" &&
                "Node completes when all tasks have recorded an outcome."}
              {completionRule === "ANY_TASK_DONE" &&
                "Node completes when any task has recorded an outcome."}
              {completionRule === "SPECIFIC_TASKS_DONE" &&
                "Node completes when specific designated tasks have recorded outcomes."}
            </p>
          </div>

          {/* Error Display */}
          {saveError && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircleIcon className="size-4 shrink-0" />
              {saveError}
            </div>
          )}

          {/* Actions */}
          {isEditable && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isSaving || (isLastEntryNode && node.isEntry)}
              >
                <TrashIcon className="size-4" />
                Delete Node
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving || !name.trim()}
              >
                {isSaving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
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
