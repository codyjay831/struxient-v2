"use client";

import { useState } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowRightIcon,
  Loader2Icon,
  TrashIcon,
  AlertCircleIcon,
  Link2OffIcon,
  LinkIcon,
  GitBranchIcon,
  CircleStopIcon,
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

interface Gate {
  id: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null;
}

interface RoutingEditorProps {
  workflowId: string;
  nodes: Node[];
  gates: Gate[];
  isEditable: boolean;
  onRoutingUpdated: () => void;
  // Highlight props for validation navigation
  highlightGateId?: string;
  highlightOutcome?: { nodeId?: string; outcomeName?: string };
}

// Helper to get all outcomes for a node
function getNodeOutcomes(node: Node): { taskId: string; taskName: string; outcomeName: string }[] {
  const outcomes: { taskId: string; taskName: string; outcomeName: string }[] = [];
  for (const task of node.tasks) {
    for (const outcome of task.outcomes) {
      outcomes.push({
        taskId: task.id,
        taskName: task.name,
        outcomeName: outcome.name,
      });
    }
  }
  return outcomes;
}

// Helper to find a gate for a specific node + outcome
function findGate(gates: Gate[], nodeId: string, outcomeName: string): Gate | undefined {
  return gates.find(
    (gate) => gate.sourceNodeId === nodeId && gate.outcomeName === outcomeName
  );
}

export function RoutingEditor({
  workflowId,
  nodes,
  gates,
  isEditable,
  onRoutingUpdated,
  highlightGateId,
  highlightOutcome,
}: RoutingEditorProps) {
  // State for route operations
  const [isLoading, setIsLoading] = useState<string | null>(null); // key = nodeId:outcomeName
  const [error, setError] = useState<string | null>(null);

  // State for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    gate: Gate;
    nodeName: string;
    outcomeName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Get node name by ID
  const getNodeName = (nodeId: string | null): string => {
    if (nodeId === null) return "(Terminal)";
    const node = nodes.find((n) => n.id === nodeId);
    return node?.name || "Unknown";
  };

  // Create or update a route
  const handleSetRoute = async (
    nodeId: string,
    outcomeName: string,
    targetNodeId: string | null,
    existingGate?: Gate
  ) => {
    const key = `${nodeId}:${outcomeName}`;
    setIsLoading(key);
    setError(null);

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

      onRoutingUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set route");
    } finally {
      setIsLoading(null);
    }
  };

  // Delete a route
  const handleDeleteRoute = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/gates/${deleteTarget.gate.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete route");
      }

      setDeleteTarget(null);
      onRoutingUpdated();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete route");
    } finally {
      setIsDeleting(false);
    }
  };

  // Count stats
  const totalOutcomes = nodes.reduce(
    (sum, node) => sum + getNodeOutcomes(node).length,
    0
  );
  const routedCount = gates.length;
  const orphanedCount = totalOutcomes - routedCount;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranchIcon className="size-4" />
              Routing Editor
            </CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <LinkIcon className="size-3" />
                {routedCount} routed
              </span>
              {orphanedCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Link2OffIcon className="size-3" />
                  {orphanedCount} orphaned
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm mb-4">
              <AlertCircleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No nodes in this workflow. Add nodes to define routing.
            </p>
          ) : totalOutcomes === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No outcomes defined. Add outcomes to tasks to define routing.
            </p>
          ) : (
            <div className="space-y-6">
              {nodes.map((node) => {
                const outcomes = getNodeOutcomes(node);
                if (outcomes.length === 0) return null;

                return (
                  <div key={node.id} className="space-y-2">
                    {/* Node Header */}
                    <h3 className="font-medium text-sm border-b pb-1">
                      {node.name}
                    </h3>

                    {/* Outcomes Table */}
                    <div className="space-y-1">
                      {outcomes.map(({ taskId, taskName, outcomeName }) => {
                        const gate = findGate(gates, node.id, outcomeName);
                        const isRouted = !!gate;
                        const rowKey = `${node.id}:${taskId}:${outcomeName}`;
                        const loadingKey = `${node.id}:${outcomeName}`;
                        const isCurrentLoading = isLoading === loadingKey;

                        // Check if this row should be highlighted
                        const isHighlightedByGate = highlightGateId && gate?.id === highlightGateId;
                        const isHighlightedByOutcome =
                          highlightOutcome?.nodeId === node.id &&
                          highlightOutcome?.outcomeName === outcomeName;
                        const isHighlighted = isHighlightedByGate || isHighlightedByOutcome;

                        return (
                          <div
                            key={rowKey}
                            className={`flex items-center gap-2 p-2 rounded-md border bg-muted/30 transition-all ${
                              isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""
                            }`}
                          >
                            {/* Source info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {outcomeName}
                                </span>
                                {isRouted ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    <LinkIcon className="size-3" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Link2OffIcon className="size-3" />
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                from {taskName}
                              </span>
                            </div>

                            {/* Arrow */}
                            <ArrowRightIcon className="size-4 text-muted-foreground shrink-0" />

                            {/* Target selector */}
                            <div className="w-48 shrink-0">
                              <select
                                value={gate?.targetNodeId ?? "__terminal__"}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const targetId =
                                    value === "__terminal__"
                                      ? null
                                      : value === "__none__"
                                      ? undefined
                                      : value;

                                  if (targetId === undefined) {
                                    // User selected "No route" - need to delete existing gate
                                    if (gate) {
                                      setDeleteTarget({
                                        gate,
                                        nodeName: node.name,
                                        outcomeName,
                                      });
                                    }
                                  } else {
                                    handleSetRoute(node.id, outcomeName, targetId, gate);
                                  }
                                }}
                                disabled={!isEditable || isCurrentLoading}
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {!isRouted && (
                                  <option value="__none__">Select target...</option>
                                )}
                                <option value="__terminal__">
                                  (Terminal) - End flow
                                </option>
                                {nodes
                                  .filter((n) => n.id !== node.id) // Can't route to self
                                  .map((targetNode) => (
                                    <option key={targetNode.id} value={targetNode.id}>
                                      {targetNode.name}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Loading indicator */}
                            {isCurrentLoading && (
                              <Loader2Icon className="size-4 animate-spin text-muted-foreground shrink-0" />
                            )}

                            {/* Delete button for routed outcomes */}
                            {isRouted && isEditable && !isCurrentLoading && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() =>
                                      setDeleteTarget({
                                        gate: gate!,
                                        nodeName: node.name,
                                        outcomeName,
                                      })
                                    }
                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                  >
                                    <TrashIcon className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete route</TooltipContent>
                              </Tooltip>
                            )}

                            {/* Terminal indicator */}
                            {gate?.targetNodeId === null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <CircleStopIcon className="size-4 text-muted-foreground shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Terminal route - flow ends here
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isEditable && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Routing is read-only for published workflows.
            </p>
          )}
        </CardContent>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Route</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the route for outcome "
                {deleteTarget?.outcomeName}" in node "{deleteTarget?.nodeName}"?
                The outcome will become orphaned.
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
                onClick={handleDeleteRoute}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2Icon className="size-4 animate-spin" />}
                Delete Route
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
}
