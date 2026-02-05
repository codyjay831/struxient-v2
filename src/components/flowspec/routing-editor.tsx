"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowRightIcon,
  Loader2Icon,
  TrashIcon,
  AlertCircleIcon,
  Link2OffIcon,
  LinkIcon,
  GitBranchIcon,
  CircleStopIcon,
  PlusIcon,
  RefreshCcwIcon,
  InfoIcon,
} from "lucide-react";
import { CreateNextNodeDialog } from "./create-next-node-dialog";
import { getWorkflowLoopbacks } from "@/lib/builder/utils/loopback-detection";
import { useLoopbackMetadata } from "@/components/builder/hooks/useLoopbackMetadata";
import { Badge } from "@/components/ui/badge";

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
  isEntry: boolean;
  tasks: Task[];
  position?: { x: number; y: number } | null;
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

// Helper to get unique outcome names for a node
function getUniqueNodeOutcomes(node: Node): string[] {
  const outcomes = new Set<string>();
  for (const task of node.tasks) {
    for (const outcome of task.outcomes) {
      outcomes.add(outcome.name);
    }
  }
  return Array.from(outcomes).sort();
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
  // Phase 1: Compute loopbacks derived at render time
  const loopbacks = useMemo(() => getWorkflowLoopbacks({ nodes, gates }), [nodes, gates]);
  
  // Phase 2: Load UI-only loopback metadata from localStorage
  const { metadata, updateLoopbackLabel } = useLoopbackMetadata(workflowId);

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

  // State for manual gate creation
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addGateData, setAddGateData] = useState<{
    sourceNodeId: string;
    outcomeName: string;
    targetNodeId: string | null;
  }>({
    sourceNodeId: "",
    outcomeName: "",
    targetNodeId: null,
  });
  const [addError, setAddError] = useState<string | null>(null);

  // Create next node state
  const [isCreateNextNodeOpen, setIsCreateNextNodeOpen] = useState(false);
  const [createNextNodeContext, setCreateNextNodeContext] = useState<{
    sourceNodeId: string;
    outcomeName: string;
    mode: "standard" | "assisted";
  } | null>(null);

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
      <Card variant="compact">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
              <GitBranchIcon className="size-4" />
              Routing Editor
            </CardTitle>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddGateData({
                    sourceNodeId: nodes[0]?.id || "",
                    outcomeName: "",
                    targetNodeId: null,
                  });
                  setAddError(null);
                  setIsAddDialogOpen(true);
                }}
                className="h-8 gap-1.5 text-xs font-semibold shadow-sm"
              >
                <PlusIcon className="size-3.5" />
                Add Gate
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-muted/30">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
              <LinkIcon className="size-3 text-green-600" />
              <span className="text-[11px] font-bold text-green-700 dark:text-green-400">{routedCount} routed</span>
            </div>
            {orphanedCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                <Link2OffIcon className="size-3 text-amber-600" />
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{orphanedCount} orphaned</span>
              </div>
            )}
            <div className="flex-1" />
            <div className="text-[10px] font-medium text-muted-foreground italic">
              Total Outcomes: {totalOutcomes}
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
          ) : (
            <div className="space-y-6">
              {nodes.map((node) => {
                const uniqueOutcomes = getUniqueNodeOutcomes(node);
                const nodeRoutedCount = uniqueOutcomes.filter(o => !!findGate(gates, node.id, o)).length;
                const nodeTotalCount = uniqueOutcomes.length;

                return (
                  <div key={node.id} className="space-y-3">
                    {/* Node Header */}
                    <div className="flex items-center justify-between border-b border-muted/50 pb-1.5 mb-2">
                      <h3 className="font-bold text-xs uppercase tracking-tight text-foreground/70">
                        {node.name}
                      </h3>
                      {nodeTotalCount > 0 && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold tracking-tight bg-muted/50 text-muted-foreground">
                          Coverage: {nodeRoutedCount} / {nodeTotalCount}
                        </Badge>
                      )}
                    </div>

                    {/* Outcomes Table */}
                    <div className="space-y-1.5">
                      {nodeTotalCount === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic py-0.5">
                          No outcomes defined for this node.
                        </p>
                      ) : (
                        uniqueOutcomes.map((outcomeName) => {
                          const gate = findGate(gates, node.id, outcomeName);
                          const isRouted = !!gate;
                          const rowKey = `${node.id}:${outcomeName}`;
                          const loadingKey = `${node.id}:${outcomeName}`;
                          const isCurrentLoading = isLoading === loadingKey;

                          // Check if this route is a loopback
                          const loopback = loopbacks.find(
                            (l) => l.sourceNodeId === node.id && l.outcomeName === outcomeName
                          );
                          const isLoopback = !!loopback;
                          const loopbackLabel = metadata[rowKey]?.label || "";
                          const autoLabel = isLoopback 
                            ? `Loop: ${node.name} → ${getNodeName(gate?.targetNodeId || null)}`
                            : "";

                          // Check if this row should be highlighted
                          const isHighlightedByGate = highlightGateId && gate?.id === highlightGateId;
                          const isHighlightedByOutcome =
                            highlightOutcome?.nodeId === node.id &&
                            highlightOutcome?.outcomeName === outcomeName;
                          const isHighlighted = isHighlightedByGate || isHighlightedByOutcome;

                          return (
                            <div
                              key={rowKey}
                              className={`flex flex-col gap-2 p-3 rounded-md border transition-all ${
                                isRouted 
                                  ? "bg-muted/30 border-border" 
                                  : "bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/10 dark:border-amber-900/30"
                              } ${
                                isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Status Badge */}
                                <div className="shrink-0 w-24">
                                  {isRouted ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      <LinkIcon className="size-3" />
                                      Routed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                      <Link2OffIcon className="size-3" />
                                      Missing
                                    </span>
                                  )}
                                </div>

                                {/* Outcome name */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs truncate">
                                      {outcomeName}
                                    </span>
                                    {isLoopback && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="h-5 px-1.5 gap-1 border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
                                            <RefreshCcwIcon className="size-2.5" />
                                            Loop
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-[10px]">Routes to an earlier node in the workflow</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>

                                {/* Arrow */}
                                <ArrowRightIcon className="size-4 text-muted-foreground shrink-0 mx-1" />

                                {/* Target selector or display */}
                                <div className="w-56 shrink-0 flex items-center gap-1.5">
                                  <select
                                    value={gate?.targetNodeId ?? (isRouted ? "__terminal__" : "__none__")}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === "__create__") {
                                        setCreateNextNodeContext({
                                          sourceNodeId: node.id,
                                          outcomeName: outcomeName,
                                          mode: "standard",
                                        });
                                        setIsCreateNextNodeOpen(true);
                                        // Restore the select value visually
                                        e.target.value = gate?.targetNodeId ?? (isRouted ? "__terminal__" : "__none__");
                                        return;
                                      }
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
                                    className={`w-full h-8 rounded-md border px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                                      !isRouted 
                                        ? "border-amber-200 bg-amber-50/50 text-amber-900 dark:border-amber-900/30 dark:bg-transparent" 
                                        : "border-input bg-background"
                                    }`}
                                  >
                                    <option value="__create__">+ Create next node...</option                                  >
                                    <option value="__create_standard__">+ Create next node...</option>
                                    <option value="__create_assisted__">✨ Assisted create & route...</option>
                                    {!isRouted && (
                                      <option value="__none__">Select next node...</option>
                                    )}
                                    <option value="__terminal__">
                                      End flow (terminal)
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
                              </div>

                              {/* Loopback Labeling UI */}
                              {isLoopback && (
                                <div className="flex items-center gap-2 pl-24 pr-1.5 py-1 border-t border-dashed bg-amber-50/30 dark:bg-amber-900/5 rounded-b-md">
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-[9px] font-semibold text-amber-700/70 dark:text-amber-400/70 uppercase">Label:</span>
                                    <Input
                                      size="compact"
                                      value={loopbackLabel}
                                      placeholder={autoLabel}
                                      onChange={(e) => updateLoopbackLabel(rowKey, e.target.value)}
                                      className="h-5 text-[10px] bg-background/50 border-amber-200/50 focus-visible:ring-amber-500/30"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
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
                The outcome will become orphaned (no valid next node).
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

        {/* Add Gate Dialog */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => !open && setIsAddDialogOpen(false)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Gate</DialogTitle>
              <DialogDescription>
                Create a new routing rule by connecting a node's outcome to a target node.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {addError && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircleIcon className="size-4" />
                  {addError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Source Node</label>
                <select
                  value={addGateData.sourceNodeId}
                  onChange={(e) => {
                    const nodeId = e.target.value;
                    const node = nodes.find((n) => n.id === nodeId);
                    const outcomes = node ? getNodeOutcomes(node) : [];
                    setAddGateData({
                      ...addGateData,
                      sourceNodeId: nodeId,
                      outcomeName: outcomes[0]?.outcomeName || "",
                    });
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>Select source node...</option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Outcome Name</label>
                <select
                  value={addGateData.outcomeName}
                  onChange={(e) =>
                    setAddGateData({ ...addGateData, outcomeName: e.target.value })
                  }
                  disabled={!addGateData.sourceNodeId}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  {!addGateData.sourceNodeId ? (
                    <option value="">Select a source node first</option>
                  ) : (
                    <>
                      {(() => {
                        const node = nodes.find((n) => n.id === addGateData.sourceNodeId);
                        const outcomes = node ? getNodeOutcomes(node) : [];
                        if (outcomes.length === 0) {
                          return <option value="">No outcomes defined for this node</option>;
                        }
                        return (
                          <>
                            <option value="" disabled>Select outcome...</option>
                            {Array.from(new Set(outcomes.map((o) => o.outcomeName))).map(
                              (name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              )
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Node</label>
                <select
                  value={addGateData.targetNodeId ?? "__terminal__"}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "__create_standard__" || value === "__create_assisted__") {
                      if (!addGateData.sourceNodeId || !addGateData.outcomeName) {
                        setAddError("Select source node and outcome first to use creation affordances");
                        // Restore select
                        e.target.value = addGateData.targetNodeId ?? "__terminal__";
                        return;
                      }
                      setCreateNextNodeContext({
                        sourceNodeId: addGateData.sourceNodeId,
                        outcomeName: addGateData.outcomeName,
                        mode: value === "__create_assisted__" ? "assisted" : "standard"
                      });
                      setIsCreateNextNodeOpen(true);
                      // Restore select
                      e.target.value = addGateData.targetNodeId ?? "__terminal__";
                      return;
                    }
                    setAddGateData({
                      ...addGateData,
                      targetNodeId: value === "__terminal__" ? null : value,
                    });
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="__create_standard__">+ Create next node...</option>
                  <option value="__create_assisted__">✨ Assisted create & route...</option>
                  <option value="__terminal__">End flow (terminal)</option>
                  {nodes
                    .filter((n) => n.id !== addGateData.sourceNodeId)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={!!isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!addGateData.sourceNodeId || !addGateData.outcomeName) {
                    setAddError("Please select both a source node and an outcome.");
                    return;
                  }

                  // Check if gate already exists locally to avoid unnecessary API call for known issues
                  const exists = gates.find(
                    (g) =>
                      g.sourceNodeId === addGateData.sourceNodeId &&
                      g.outcomeName === addGateData.outcomeName
                  );
                  if (exists) {
                    setAddError(`A route for outcome "${addGateData.outcomeName}" already exists in this node.`);
                    return;
                  }

                  setAddError(null);
                  const key = `${addGateData.sourceNodeId}:${addGateData.outcomeName}`;
                  setIsLoading(key);

                  try {
                    const response = await fetch(
                      `/api/flowspec/workflows/${workflowId}/gates`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sourceNodeId: addGateData.sourceNodeId,
                          outcomeName: addGateData.outcomeName,
                          targetNodeId: addGateData.targetNodeId,
                        }),
                      }
                    );

                    if (!response.ok) {
                      const data = await response.json();
                      throw new Error(data.error?.message || "Failed to create gate");
                    }

                    setIsAddDialogOpen(false);
                    onRoutingUpdated();
                  } catch (err) {
                    setAddError(err instanceof Error ? err.message : "Failed to create gate");
                  } finally {
                    setIsLoading(null);
                  }
                }}
                disabled={!!isLoading || !addGateData.sourceNodeId || !addGateData.outcomeName}
              >
                {isLoading && <Loader2Icon className="size-4 animate-spin" />}
                Create Gate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Next Node Dialog */}
        {createNextNodeContext && (
          <CreateNextNodeDialog
            workflowId={workflowId}
            sourceNodeId={createNextNodeContext.sourceNodeId}
            sourceNodeName={nodes.find((n) => n.id === createNextNodeContext.sourceNodeId)?.name || "Unknown"}
            outcomeName={createNextNodeContext.outcomeName}
            sourcePosition={nodes.find((n) => n.id === createNextNodeContext.sourceNodeId)?.position}
            open={isCreateNextNodeOpen}
            onOpenChange={setIsCreateNextNodeOpen}
            onCreated={() => {
              onRoutingUpdated();
              setIsCreateNextNodeOpen(false);
              setIsAddDialogOpen(false); // If we were in Add Gate dialog, close it too
            }}
            mode={createNextNodeContext.mode}
          />
        )}
      </Card>
    </TooltipProvider>
  );
}
