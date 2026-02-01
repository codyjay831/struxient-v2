"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
import { WorkflowStatusBadge, WorkflowStatus } from "@/components/flowspec/workflow-status-badge";
import { ValidationResultsDialog, ValidationError, parseValidationPath } from "@/components/flowspec/validation-results-dialog";
import { CreateNodeDialog } from "@/components/flowspec/create-node-dialog";
import { NodeDetailPanel, CompletionRule } from "@/components/flowspec/node-detail-panel";
import { RoutingEditor } from "@/components/flowspec/routing-editor";
import { FanOutRulesEditor } from "@/components/flowspec/fan-out-rules-editor";
import { WorkflowVersionsCard, WorkflowVersion } from "@/components/flowspec/workflow-versions-card";
import {
  Loader2Icon,
  ArrowLeftIcon,
  CheckCircleIcon,
  SendIcon,
  AlertCircleIcon,
  LayersIcon,
  FlagIcon,
} from "lucide-react";

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

interface FanOutRule {
  id: string;
  sourceNodeId: string;
  triggerOutcome: string;
  targetWorkflowId: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  version: number;
  isNonTerminating: boolean;
  nodes: Node[];
  gates: Gate[];
  fanOutRules: FanOutRule[];
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.workflowId as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Versions state
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: ValidationError[];
  } | null>(null);
  
  // Publish state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [impactReport, setImpactReport] = useState<any | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Revert to Draft state
  const [isReverting, setIsReverting] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  // Highlight state for validation navigation (2s TTL)
  const [highlight, setHighlight] = useState<{
    type: "node" | "task" | "outcome" | "gate";
    nodeId?: string;
    taskId?: string;
    outcomeName?: string;
    gateId?: string;
  } | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const fetchWorkflow = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch workflow");
      }

      setWorkflow(data.workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workflow");
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  const fetchVersions = useCallback(async () => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/versions`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch versions");
      }

      setVersions(data.items || []);
    } catch (err) {
      setVersionsError(err instanceof Error ? err.message : "Failed to fetch versions");
    } finally {
      setVersionsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
    fetchVersions();
  }, [fetchWorkflow, fetchVersions]);

  const handleValidate = async () => {
    if (!workflow) return;
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/validate`, {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok && data.valid) {
        setValidationResult({ isValid: true, errors: [] });
        // Refresh workflow to get updated status
        await fetchWorkflow();
      } else {
        // Parse errors from response
        const errors: ValidationError[] = data.error?.details || [];
        if (errors.length === 0 && data.error?.message) {
          errors.push({ code: data.error.code || "ERROR", message: data.error.message });
        }
        setValidationResult({ isValid: false, errors });
      }
      setValidationOpen(true);
    } catch {
      setValidationResult({
        isValid: false,
        errors: [{ code: "NETWORK_ERROR", message: "Failed to validate workflow" }],
      });
      setValidationOpen(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePublishClick = async () => {
    if (!workflow) return;
    setPublishDialogOpen(true);
    setImpactLoading(true);
    setImpactReport(null);
    setPublishError(null);

    try {
      // 1. Prepare current draft snapshot
      const snapshot = {
        workflowId: workflow.id,
        name: workflow.name,
        nodes: workflow.nodes,
        gates: workflow.gates,
      };

      // 2. Call impact API
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (response.ok) {
        const report = await response.json();
        setImpactReport(report);
      } else {
        setImpactReport({
          breakingChanges: [],
          activeFlowsCount: 0,
          isAnalysisComplete: false,
          message: "Impact analysis unavailable"
        });
      }
    } catch (err) {
      setImpactReport({
        breakingChanges: [],
        activeFlowsCount: 0,
        isAnalysisComplete: false,
        message: "Impact analysis unavailable (error)"
      });
    } finally {
      setImpactLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!workflow) return;
    setIsPublishing(true);
    setPublishError(null);

    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/publish`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to publish workflow");
      }

      // Success - refresh workflow to show new status and versions list
      await fetchWorkflow();
      await fetchVersions();
      setPublishDialogOpen(false);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Failed to publish workflow");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!workflow) return;
    setIsReverting(true);
    setRevertError(null);

    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/revert-to-draft`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to revert workflow to draft");
      }

      // Success - refresh workflow to show DRAFT status
      await fetchWorkflow();
      setRevertDialogOpen(false);
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : "Failed to revert workflow to draft");
    } finally {
      setIsReverting(false);
    }
  };

  const selectedNode = workflow?.nodes.find((n) => n.id === selectedNodeId) || null;
  const isEditable = workflow?.status === "DRAFT";
  const canPublish = workflow?.status === "VALIDATED";
  
  // Count entry nodes for safety checks
  const entryNodeCount = workflow?.nodes.filter((n) => n.isEntry).length ?? 0;
  const isLastEntryNode = entryNodeCount === 1;

  // Handle node deletion - clear selection if deleted node was selected
  const handleNodeDeleted = () => {
    setSelectedNodeId(null);
    fetchWorkflow();
  };

  // Clear highlight after 2 seconds
  const applyHighlight = useCallback((highlightState: typeof highlight) => {
    setHighlight(highlightState);
    setNavigationError(null);
    setTimeout(() => setHighlight(null), 2000);
  }, []);

  // Navigate to issue from validation results
  const navigateToIssue = useCallback(
    (error: ValidationError) => {
      if (!workflow) return;

      const parsed = parseValidationPath(error.path);

      // Gate-level errors (path is "gates" or no specific node)
      if (parsed.isGatesLevel || (parsed.gateIndex !== undefined && parsed.nodeIndex === undefined)) {
        // Scroll to routing editor and show a general highlight
        applyHighlight({ type: "gate" });
        setValidationOpen(false);
        // Scroll routing editor into view
        setTimeout(() => {
          document.getElementById("routing-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        return;
      }

      // Node-level errors
      if (parsed.nodeIndex !== undefined) {
        const node = workflow.nodes[parsed.nodeIndex];
        if (!node) {
          setNavigationError(`Cannot jump: node at index ${parsed.nodeIndex} not found`);
          return;
        }

        // Select the node
        setSelectedNodeId(node.id);

        // Gate error within a node
        if (parsed.gateIndex !== undefined) {
          // Find the gate by looking at node's gates
          const nodeGates = workflow.gates.filter((g) => g.sourceNodeId === node.id);
          const gate = nodeGates[parsed.gateIndex];
          if (gate) {
            applyHighlight({ type: "gate", nodeId: node.id, gateId: gate.id });
            setValidationOpen(false);
            setTimeout(() => {
              document.getElementById("routing-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          } else {
            applyHighlight({ type: "node", nodeId: node.id });
            setValidationOpen(false);
          }
          return;
        }

        // Task-level errors
        if (parsed.taskIndex !== undefined) {
          const task = node.tasks[parsed.taskIndex];
          if (!task) {
            applyHighlight({ type: "node", nodeId: node.id });
            setNavigationError(`Cannot jump to task: task at index ${parsed.taskIndex} not found`);
            setValidationOpen(false);
            return;
          }

          // Outcome-level errors
          if (parsed.outcomeName) {
            // Find outcome in task by name
            const outcome = task.outcomes.find((o) => o.name === parsed.outcomeName);
            if (outcome) {
              applyHighlight({
                type: "outcome",
                nodeId: node.id,
                taskId: task.id,
                outcomeName: parsed.outcomeName,
              });
            } else {
              // Outcome not found, highlight task instead
              applyHighlight({ type: "task", nodeId: node.id, taskId: task.id });
            }
            setValidationOpen(false);
            return;
          }

          // Just a task error
          applyHighlight({ type: "task", nodeId: node.id, taskId: task.id });
          setValidationOpen(false);
          return;
        }

        // Just a node error
        applyHighlight({ type: "node", nodeId: node.id });
        setValidationOpen(false);
        return;
      }

      // Cannot determine location
      setNavigationError("Cannot jump: insufficient location data in error");
    },
    [workflow, applyHighlight]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="space-y-6">
        <Link href="/flowspec">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="size-4" />
            Back to Workflows
          </Button>
        </Link>
        <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertCircleIcon className="size-4" />
          <p className="text-sm">{error || "Workflow not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Link href="/flowspec">
              <Button variant="ghost" size="sm" className="-ml-2 mb-2">
                <ArrowLeftIcon className="size-4" />
                Back to Workflows
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{workflow.name}</h1>
              <WorkflowStatusBadge status={workflow.status} />
              {workflow.version > 1 && (
                <span className="text-sm text-muted-foreground">v{workflow.version}</span>
              )}
            </div>
            {workflow.description && (
              <p className="text-muted-foreground">{workflow.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Validate Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleValidate}
                    disabled={isValidating || workflow.status === "PUBLISHED"}
                  >
                    {isValidating ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="size-4" />
                    )}
                    Validate
                  </Button>
                </span>
              </TooltipTrigger>
              {workflow.status === "PUBLISHED" && (
                <TooltipContent>
                  Published workflows cannot be modified
                </TooltipContent>
              )}
            </Tooltip>

            {/* Return to Draft Button (VALIDATED only) */}
            {workflow.status === "VALIDATED" && (
              <Button
                variant="outline"
                onClick={() => setRevertDialogOpen(true)}
                disabled={isReverting}
              >
                {isReverting ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArrowLeftIcon className="size-4" />
                )}
                Return to Draft
              </Button>
            )}

            {/* Publish Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handlePublishClick}
                    disabled={!canPublish || isPublishing}
                  >
                    {isPublishing ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SendIcon className="size-4" />
                    )}
                    Publish
                  </Button>
                </span>
              </TooltipTrigger>
              {!canPublish && (
                <TooltipContent>
                  {workflow.status === "PUBLISHED"
                    ? "Workflow is already published"
                    : "Validate workflow before publishing"}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        {/* INV-011 Banner for Published Workflows */}
        {workflow.status === "PUBLISHED" && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-sm">
            <AlertCircleIcon className="size-4" />
            This workflow is published and cannot be modified. Create a new version to make changes.
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Nodes List */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2">
                <LayersIcon className="size-4" />
                Nodes
                <span className="text-sm font-normal text-muted-foreground">
                  ({workflow.nodes.length})
                </span>
              </CardTitle>
              {isEditable && (
                <CreateNodeDialog
                  workflowId={workflowId}
                  onNodeCreated={fetchWorkflow}
                  disabled={!isEditable}
                />
              )}
            </CardHeader>
            <CardContent>
              {workflow.nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No nodes yet.
                  {isEditable && " Add nodes to build your workflow."}
                </p>
              ) : (
                <div className="space-y-1">
                  {workflow.nodes.map((node) => {
                    const isHighlighted = highlight?.type === "node" && highlight.nodeId === node.id;
                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                          selectedNodeId === node.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        } ${isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{node.name}</span>
                          {node.isEntry && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <FlagIcon className="size-3 text-green-600" />
                              </TooltipTrigger>
                              <TooltipContent>Entry Node</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {node.tasks.length} task{node.tasks.length !== 1 ? "s" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Node Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedNode ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-sm text-muted-foreground text-center">
                    Select a node to view and edit its properties
                  </p>
                </CardContent>
              </Card>
            ) : (
              <NodeDetailPanel
                workflowId={workflowId}
                node={selectedNode}
                gates={workflow.gates}
                isEditable={isEditable}
                isLastEntryNode={isLastEntryNode && selectedNode.isEntry}
                onNodeUpdated={fetchWorkflow}
                onNodeDeleted={handleNodeDeleted}
                highlightTaskId={
                  (highlight?.type === "task" || highlight?.type === "outcome") &&
                  highlight.nodeId === selectedNode.id
                    ? highlight.taskId
                    : undefined
                }
                highlightOutcome={
                  highlight?.type === "outcome" && highlight.nodeId === selectedNode.id
                    ? { taskId: highlight.taskId, outcomeName: highlight.outcomeName }
                    : undefined
                }
              />
            )}
          </div>
        </div>

        {/* Routing Editor */}
        <div id="routing-editor">
          <RoutingEditor
            workflowId={workflowId}
            nodes={workflow.nodes}
            gates={workflow.gates}
            isEditable={isEditable}
            onRoutingUpdated={fetchWorkflow}
            highlightGateId={highlight?.type === "gate" ? highlight.gateId : undefined}
            highlightOutcome={
              highlight?.type === "outcome"
                ? { nodeId: highlight.nodeId, outcomeName: highlight.outcomeName }
                : undefined
            }
          />
        </div>

        {/* Fan-Out Rules Editor */}
        <div id="fan-out-rules">
          <FanOutRulesEditor
            workflowId={workflowId}
            nodes={workflow.nodes}
            fanOutRules={workflow.fanOutRules}
            isEditable={isEditable}
            onRulesUpdated={fetchWorkflow}
          />
        </div>

        {/* Versions Section */}
        <div id="versions">
          <WorkflowVersionsCard
            workflowId={workflowId}
            versions={versions}
            isLoading={versionsLoading}
            error={versionsError}
          />
        </div>

        {/* Validation Results Dialog */}
        {validationResult && (
          <ValidationResultsDialog
            open={validationOpen}
            onOpenChange={setValidationOpen}
            isValid={validationResult.isValid}
            errors={validationResult.errors}
            onNavigateToIssue={navigateToIssue}
          />
        )}

        {/* Navigation Error Toast */}
        {navigationError && (
          <div className="fixed bottom-4 right-4 p-3 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm shadow-lg max-w-sm">
            {navigationError}
          </div>
        )}

        {/* Publish Confirmation Dialog */}
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Publish Workflow</DialogTitle>
              <DialogDescription>
                Publishing will create an immutable version of this workflow that can be used
                to create Flows. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {/* Impact Analysis Results */}
            <div className="py-4 border-y my-4 space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                {impactLoading ? (
                  <Loader2Icon className="size-4 animate-spin text-primary" />
                ) : (
                  <CheckCircleIcon className="size-4 text-green-600" />
                )}
                In-flight Impact Analysis
              </h4>

              {impactLoading ? (
                <p className="text-xs text-muted-foreground italic">Analyzing active jobs and cross-flow dependencies...</p>
              ) : impactReport ? (
                <div className="space-y-3">
                  {impactReport.breakingChanges.length === 0 ? (
                    <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-xs border border-green-100 dark:border-green-900/30">
                      No breaking changes detected for {impactReport.activeFlowsCount} active jobs.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive font-bold uppercase tracking-wider">⚠️ Breaking Changes Detected</p>
                      {impactReport.breakingChanges.map((change: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs border border-amber-100 dark:border-amber-900/30 space-y-1">
                          <p className="font-semibold">{change.message}</p>
                          <p className="opacity-80">This will stall {change.affectedFlowsCount} active jobs.</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!impactReport.isAnalysisComplete && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Note: {impactReport.message || "Full impact analysis unavailable. Proceed with caution."}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {publishError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircleIcon className="size-4" />
                {publishError}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPublishDialogOpen(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePublish} 
                disabled={isPublishing}
                variant={impactReport?.breakingChanges?.length > 0 ? "destructive" : "default"}
              >
                {isPublishing && <Loader2Icon className="size-4 animate-spin mr-2" />}
                {impactReport?.breakingChanges?.length > 0 ? "Publish anyway" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revert to Draft Confirmation Dialog */}
        <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return to Draft</DialogTitle>
              <DialogDescription>
                This will revert the workflow to Draft status, allowing you to make changes.
                You will need to validate again before publishing.
              </DialogDescription>
            </DialogHeader>
            {revertError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircleIcon className="size-4" />
                {revertError}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRevertDialogOpen(false)}
                disabled={isReverting}
              >
                Cancel
              </Button>
              <Button onClick={handleRevertToDraft} disabled={isReverting}>
                {isReverting && <Loader2Icon className="size-4 animate-spin" />}
                Return to Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
