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
  ArrowRightIcon,
} from "lucide-react";

interface Outcome {
  id: string;
  name: string;
}

interface Node {
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
  nodes: Node[];
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
  nodes,
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

  // Routing state
  const [routingLoading, setRoutingLoading] = useState<string | null>(null); // outcomeName
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routeDeleteTarget, setRouteDeleteTarget] = useState<{
    gate: Gate;
    outcomeName: string;
  } | null>(null);

  // Helper to find a gate for a specific outcome
  const findGate = (outcomeName: string): Gate | undefined => {
    return gates.find(
      (gate) => gate.sourceNodeId === nodeId && gate.outcomeName === outcomeName
    );
  };

  // Handle set route
  const handleSetRoute = async (outcomeName: string, targetNodeId: string | null) => {
    setRoutingLoading(outcomeName);
    setRoutingError(null);

    const existingGate = findGate(outcomeName);

    try {
      if (existingGate) {
        // Update existing gate
        const response = await fetch(
          `/api/flowspec/workflows/${workflowId}/gates/${existingGate.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetNodeId }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "Failed to update route");
        }
      } else {
        // Create new gate
        const response = await fetch(
          `/api/flowspec/workflows/${workflowId}/gates`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceNodeId: nodeId,
              outcomeName,
              targetNodeId,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "Failed to create route");
        }
      }

      onOutcomesUpdated();
    } catch (err) {
      setRoutingError(err instanceof Error ? err.message : "Failed to set route");
    } finally {
      setRoutingLoading(null);
    }
  };

  // Handle delete route
  const handleDeleteRoute = async () => {
    if (!routeDeleteTarget) return;
    setRoutingLoading(routeDeleteTarget.outcomeName);
    setRoutingError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/gates/${routeDeleteTarget.gate.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete route");
      }

      setRouteDeleteTarget(null);
      onOutcomesUpdated();
    } catch (err) {
      setRoutingError(err instanceof Error ? err.message : "Failed to delete route");
    } finally {
      setRoutingLoading(null);
    }
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
          <label className="text-sm font-medium">Outcomes & Routing</label>
          {isEditable && !isAdding && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsAdding(true)}
            >
              <PlusIcon className="size-3" />
              Add Outcome
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

        {routingError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircleIcon className="size-3" />
            {routingError}
          </p>
        )}

        {/* Outcomes list */}
        {outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No outcomes defined.
            {isEditable && " Add outcomes to define what can happen when this task completes."}
          </p>
        ) : (
          <div className="space-y-2">
            {outcomes.map((outcome) => {
              const gate = findGate(outcome.name);
              const isRouted = !!gate;
              const isEditing = editingId === outcome.id;
              const isHighlighted = highlightOutcomeName === outcome.name;
              const isCurrentRoutingLoading = routingLoading === outcome.name;

              return (
                <div
                  key={outcome.id}
                  className={`flex flex-col gap-2 p-2 rounded-md border bg-muted/30 transition-all ${
                    isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
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
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <LinkIcon className="size-2.5" />
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
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                <Link2OffIcon className="size-2.5" />
                                Orphaned
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              This outcome has no route — add a target below
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
                                    className="text-muted-foreground hover:text-foreground h-6 w-6"
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
                                    className="text-muted-foreground hover:text-destructive h-6 w-6"
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

                  {/* Target Dropdown */}
                  {!isEditing && (
                    <div className="flex items-center gap-2 mt-1 border-t border-dashed pt-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <ArrowRightIcon className="size-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase shrink-0">Target:</span>
                        <select
                          value={gate?.targetNodeId ?? (isRouted ? "__terminal__" : "__none__")}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "__none__") {
                              if (gate) setRouteDeleteTarget({ gate, outcomeName: outcome.name });
                            } else {
                              handleSetRoute(outcome.name, value === "__terminal__" ? null : value);
                            }
                          }}
                          disabled={!isEditable || isCurrentRoutingLoading}
                          className={`flex-1 h-7 rounded border px-1.5 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                            !isRouted 
                              ? "border-amber-200 bg-amber-50/50 text-amber-900 dark:border-amber-900/30 dark:bg-transparent" 
                              : "border-input bg-background"
                          }`}
                        >
                          {!isRouted && <option value="__none__">Select target...</option>}
                          {isRouted && <option value="__none__">None (Clear route)</option>}
                          <option value="__terminal__">(Terminal) - End flow</option>
                          {nodes
                            .filter((n) => n.id !== nodeId)
                            .map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.name}
                              </option>
                            ))}
                        </select>
                        {isCurrentRoutingLoading && <Loader2Icon className="size-3 animate-spin text-muted-foreground shrink-0" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {editError && (
          <p className="text-xs text-destructive">{editError}</p>
        )}

        {/* Delete Outcome Confirmation Dialog */}
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

        {/* Delete Route Confirmation Dialog */}
        <Dialog
          open={!!routeDeleteTarget}
          onOpenChange={(open) => !open && setRouteDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Route</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove the route for outcome "
                {routeDeleteTarget?.outcomeName}"?
                The outcome will become orphaned.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRouteDeleteTarget(null)}
                disabled={!!routingLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRoute}
                disabled={!!routingLoading}
              >
                {routingLoading && <Loader2Icon className="size-4 animate-spin mr-2" />}
                Clear Route
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
