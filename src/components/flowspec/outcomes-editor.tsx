"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PlusIcon,
  Loader2Icon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  LinkIcon,
  Link2OffIcon,
} from "lucide-react";

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

interface OutcomesEditorProps {
  workflowId: string;
  nodeId: string;
  taskId: string;
  outcomes: Outcome[];
  gates: Gate[];
  isEditable: boolean;
  onOutcomesUpdated: () => void;
  // Highlight prop for validation navigation
  highlightOutcomeName?: string;
}

export function OutcomesEditor({
  workflowId,
  nodeId,
  taskId,
  outcomes,
  gates,
  isEditable,
  onOutcomesUpdated,
  highlightOutcomeName,
}: OutcomesEditorProps) {
  // Add outcome state
  const [isAdding, setIsAdding] = useState(false);
  const [newOutcomeName, setNewOutcomeName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddLoading, setIsAddLoading] = useState(false);

  // Edit outcome state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Delete outcome state
  const [deleteTarget, setDeleteTarget] = useState<Outcome | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if an outcome is routed (has a gate)
  const isOutcomeRouted = (outcomeName: string): boolean => {
    return gates.some(
      (gate) => gate.sourceNodeId === nodeId && gate.outcomeName === outcomeName
    );
  };

  // Handle add outcome
  const handleAdd = async () => {
    if (!newOutcomeName.trim()) return;
    setIsAddLoading(true);
    setAddError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/outcomes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newOutcomeName.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setAddError(data.error?.message || "Failed to add outcome");
        return;
      }

      setNewOutcomeName("");
      setIsAdding(false);
      onOutcomesUpdated();
    } catch {
      setAddError("Failed to add outcome. Please try again.");
    } finally {
      setIsAddLoading(false);
    }
  };

  // Handle start editing
  const startEditing = (outcome: Outcome) => {
    setEditingId(outcome.id);
    setEditName(outcome.name);
    setEditError(null);
  };

  // Handle cancel editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditError(null);
  };

  // Handle save edit
  const handleSaveEdit = async (outcomeId: string) => {
    if (!editName.trim()) return;
    setIsEditLoading(true);
    setEditError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/outcomes/${outcomeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.error?.message || "Failed to rename outcome");
        return;
      }

      cancelEditing();
      onOutcomesUpdated();
    } catch {
      setEditError("Failed to rename outcome. Please try again.");
    } finally {
      setIsEditLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/outcomes/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error?.message || "Failed to delete outcome");
        return;
      }

      setDeleteTarget(null);
      onOutcomesUpdated();
    } catch {
      setDeleteError("Failed to delete outcome. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Outcomes</label>
          {isEditable && !isAdding && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsAdding(true)}
            >
              <PlusIcon className="size-3" />
              Add
            </Button>
          )}
        </div>

        {/* Add new outcome form */}
        {isAdding && (
          <div className="flex items-center gap-2">
            <Input
              value={newOutcomeName}
              onChange={(e) => setNewOutcomeName(e.target.value)}
              placeholder="Outcome name (e.g., APPROVED)"
              className="h-8 text-sm"
              disabled={isAddLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewOutcomeName("");
                  setAddError(null);
                }
              }}
              autoFocus
            />
            <Button
              size="icon-xs"
              onClick={handleAdd}
              disabled={isAddLoading || !newOutcomeName.trim()}
            >
              {isAddLoading ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <CheckIcon className="size-3" />
              )}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewOutcomeName("");
                setAddError(null);
              }}
              disabled={isAddLoading}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        )}

        {addError && (
          <p className="text-xs text-destructive">{addError}</p>
        )}

        {/* Outcomes list */}
        {outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No outcomes defined.
            {isEditable && " Add outcomes to define what can happen when this task completes."}
          </p>
        ) : (
          <div className="space-y-1">
            {outcomes.map((outcome) => {
              const isRouted = isOutcomeRouted(outcome.name);
              const isEditing = editingId === outcome.id;
              const isHighlighted = highlightOutcomeName === outcome.name;

              return (
                <div
                  key={outcome.id}
                  className={`flex items-center gap-2 p-2 rounded-md border bg-muted/30 transition-all ${
                    isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""
                  }`}
                >
                  {isEditing ? (
                    // Edit mode
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        disabled={isEditLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(outcome.id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                        autoFocus
                      />
                      <Button
                        size="icon-xs"
                        onClick={() => handleSaveEdit(outcome.id)}
                        disabled={isEditLoading || !editName.trim() || editName === outcome.name}
                      >
                        {isEditLoading ? (
                          <Loader2Icon className="size-3 animate-spin" />
                        ) : (
                          <CheckIcon className="size-3" />
                        )}
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={cancelEditing}
                        disabled={isEditLoading}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </>
                  ) : (
                    // Display mode
                    <>
                      <span className="font-medium text-sm flex-1 truncate">
                        {outcome.name}
                      </span>

                      {/* Routed/Orphaned badge */}
                      {isRouted ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <LinkIcon className="size-3" />
                              Routed
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            This outcome has a route defined
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <Link2OffIcon className="size-3" />
                              Orphaned
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            This outcome has no route — add one in the Routing Editor
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Action buttons */}
                      {isEditable && (
                        <div className="flex items-center gap-1">
                          {/* Rename button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => startEditing(outcome)}
                                  disabled={isRouted}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <PencilIcon className="size-3" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isRouted
                                ? "Cannot rename — remove route first"
                                : "Rename outcome"}
                            </TooltipContent>
                          </Tooltip>

                          {/* Delete button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => setDeleteTarget(outcome)}
                                  disabled={isRouted}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <TrashIcon className="size-3" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isRouted
                                ? "Cannot delete — remove route first"
                                : "Delete outcome"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {editError && (
          <p className="text-xs text-destructive">{editError}</p>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Outcome</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the outcome "{deleteTarget?.name}"?
                This action cannot be undone.
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
                onClick={() => setDeleteTarget(null)}
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
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
