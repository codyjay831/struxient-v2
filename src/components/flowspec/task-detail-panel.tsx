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
  AlertCircleIcon,
  FileTextIcon,
  ClipboardCheckIcon,
} from "lucide-react";
import { OutcomesEditor } from "./outcomes-editor";
import { EvidenceSchemaEditor } from "./evidence-schema-editor";
import { CrossFlowDepsEditor } from "./cross-flow-deps-editor";

interface Outcome {
  id: string;
  name: string;
}

interface Gate {
  id: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null;
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

interface TaskDetailPanelProps {
  workflowId: string;
  nodeId: string;
  task: Task;
  gates: Gate[];
  isEditable: boolean;
  onTaskUpdated: () => void;
  onTaskDeleted: () => void;
  onClose: () => void;
  // Highlight prop for validation navigation
  highlightOutcomeName?: string;
}

export function TaskDetailPanel({
  workflowId,
  nodeId,
  task,
  gates,
  isEditable,
  onTaskUpdated,
  onTaskDeleted,
  onClose,
  highlightOutcomeName,
}: TaskDetailPanelProps) {
  // Form state
  const [name, setName] = useState(task.name);
  const [instructions, setInstructions] = useState(task.instructions || "");
  const [evidenceRequired, setEvidenceRequired] = useState(
    task.evidenceRequired ?? false
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset form when task changes
  useEffect(() => {
    setName(task.name);
    setInstructions(task.instructions || "");
    setEvidenceRequired(task.evidenceRequired ?? false);
    setHasChanges(false);
    setSaveError(null);
  }, [task.id, task.name, task.instructions, task.evidenceRequired]);

  // Track changes
  useEffect(() => {
    const changed =
      name !== task.name ||
      instructions !== (task.instructions || "") ||
      evidenceRequired !== (task.evidenceRequired ?? false);
    setHasChanges(changed);
  }, [name, instructions, evidenceRequired, task.name, task.instructions, task.evidenceRequired]);

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name !== task.name ? name : undefined,
            instructions: instructions !== (task.instructions || "") ? (instructions || null) : undefined,
            evidenceRequired: evidenceRequired !== (task.evidenceRequired ?? false) ? evidenceRequired : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error?.message || "Failed to save changes");
        return;
      }

      onTaskUpdated();
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
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${task.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error?.message || "Failed to delete task");
        return;
      }

      setDeleteDialogOpen(false);
      onTaskDeleted();
    } catch {
      setDeleteError("Failed to delete task. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileTextIcon className="size-4" />
            Task Details
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="task-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="task-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditable || isSaving}
            placeholder="Task name"
          />
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <label htmlFor="task-instructions" className="text-sm font-medium">
            Instructions
          </label>
          <textarea
            id="task-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={!isEditable || isSaving}
            placeholder="Instructions for completing this task"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Evidence Required Toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="evidence-required"
              checked={evidenceRequired}
              onChange={(e) => setEvidenceRequired(e.target.checked)}
              disabled={!isEditable || isSaving}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="evidence-required" className="text-sm flex items-center gap-1">
              <ClipboardCheckIcon className="size-3 text-blue-600" />
              Require Evidence
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            When enabled, this task requires evidence to be attached when recording an outcome.
          </p>
        </div>

        {/* Evidence Schema Editor */}
        {evidenceRequired && (
          <EvidenceSchemaEditor
            workflowId={workflowId}
            nodeId={nodeId}
            taskId={task.id}
            isEditable={isEditable}
            initialSchema={task.evidenceSchema}
            onSchemaUpdated={onTaskUpdated}
          />
        )}

        {/* Cross-Flow Dependencies Editor */}
        <CrossFlowDepsEditor
          workflowId={workflowId}
          nodeId={nodeId}
          taskId={task.id}
          isEditable={isEditable}
          dependencies={task.crossFlowDependencies}
          onDependenciesUpdated={onTaskUpdated}
        />

        {/* Outcomes Editor */}
        <OutcomesEditor
          workflowId={workflowId}
          nodeId={nodeId}
          taskId={task.id}
          outcomes={task.outcomes}
          gates={gates}
          isEditable={isEditable}
          onOutcomesUpdated={onTaskUpdated}
          highlightOutcomeName={highlightOutcomeName}
        />

        {/* Error Display */}
        {saveError && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircleIcon className="size-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Actions */}
        {isEditable && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isSaving}
            >
              <TrashIcon className="size-4" />
              Delete Task
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
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{task.name}"? This will also delete all
              outcomes for this task. This action cannot be undone.
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
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
