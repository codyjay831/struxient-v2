"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { WorkflowStatusBadge, WorkflowStatus } from "@/components/flowspec/workflow-status-badge";
import { ValidationResultsDialog, ValidationError, parseValidationPath } from "@/components/flowspec/validation-results-dialog";
import { CreateNodeDialog } from "@/components/flowspec/create-node-dialog";
import { NodeDetailPanel, CompletionRule } from "@/components/flowspec/node-detail-panel";
import { EdgeDetailPanel } from "@/components/flowspec/edge-detail-panel";
import { RoutingEditor } from "@/components/flowspec/routing-editor";
import { LoopbackIndexPanel } from "@/components/builder/loopback-index-panel";
import { FanOutRulesEditor } from "@/components/flowspec/fan-out-rules-editor";
import { WorkflowVersionsCard, WorkflowVersion } from "@/components/flowspec/workflow-versions-card";
import { WorkflowCanvas, WorkflowCanvasRef } from "@/components/canvas/workflow-canvas";
import { useSidebar } from "@/components/nav/sidebar-context";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { DraggableResizablePanel } from "@/components/flowspec/draggable-resizable-panel";
import { generateEdgeKey, computeNodeDepths, detectEdgeType } from "@/lib/canvas/layout";
import { computeSemanticDiff, SemanticChange } from "@/lib/flowspec/diff";
import { BuilderSaveStatus } from "@/components/flowspec/builder-save-status";
import { BuilderCommitDialog } from "@/components/flowspec/builder-commit-dialog";
import { BuilderHistoryPanel } from "@/components/flowspec/builder-history-panel";
import {
  Loader2Icon,
  ArrowLeftIcon,
  CheckCircleIcon,
  SendIcon,
  AlertCircleIcon,
  LayersIcon,
  FlagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SettingsIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
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
  nodeKind: "MAINLINE" | "DETOUR";
  completionRule: CompletionRule;
  tasks: Task[];
  position?: { x: number; y: number } | null;
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
  _isDraft?: boolean;
  _bufferUpdatedAt?: string;
  _baseEventId?: string | null;
}

interface BuilderSessionState {
  isDraft: boolean;
  isPublished: boolean;
  isValidated: boolean;
  isEditable: boolean;
  isLastEntryNode: boolean;
  canCommit: boolean;
  canDiscard: boolean;
  canValidate: boolean;
  canPublish: boolean;
  changeCount: number;
  lastSavedAt: string | Date | undefined;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.workflowId as string;
  const { collapsed } = useSidebar();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  const canvasRef = useRef<WorkflowCanvasRef>(null);

  // Selection handlers following mutual exclusivity rule
  const handleNodeSelect = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) setSelectedEdgeKey(null);
  };

  const handleEdgeSelect = (key: string | null) => {
    setSelectedEdgeKey(key);
    if (key) setSelectedNodeId(null);
  };

  const handleClearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdgeKey(null);
  };

  const handleNodeDragEnd = async (nodeId: string, position: { x: number; y: number }) => {
    if (!sessionState.isEditable) return;

    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
      });

      if (!response.ok) {
        console.error("Failed to persist node position");
      }
      // Note: We don't refresh the full workflow here to avoid layout jank during interaction.
      // The local position state in WorkflowCanvas handles visual consistency.
    } catch (err) {
      console.error("Error persisting node position", err);
    }
  };
  
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

  // --- SAVE SAFETY STATE ---
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [draftHistory, setDraftHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [baseSnapshot, setBaseSnapshot] = useState<any>(null);
  const [isCommitLoading, setIsCommitLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const lastFetchedBaseId = useRef<string | null>(null);

  // Derive semantic diff from snapshots
  const semanticDiff = useMemo(() => {
    if (workflow && baseSnapshot) {
      return computeSemanticDiff(baseSnapshot, workflow);
    }
    return [];
  }, [workflow, baseSnapshot]);

  // Clear status after 3 seconds
  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/history`);
      const data = await response.json();
      if (response.ok) {
        setDraftHistory(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [workflowId]);

  const fetchBaseSnapshot = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/history/${eventId}`);
      const data = await response.json();
      if (response.ok) {
        setBaseSnapshot(data.event.snapshot);
      }
    } catch (err) {
      console.error("Failed to fetch base snapshot", err);
    }
  }, [workflowId]);

  // Proactively fetch base snapshot when workflow changes
  useEffect(() => {
    const baseId = workflow?._baseEventId;
    if (baseId && baseId !== lastFetchedBaseId.current) {
      lastFetchedBaseId.current = baseId;
      fetchBaseSnapshot(baseId);
    } else if (workflow && !workflow._isDraft) {
      lastFetchedBaseId.current = null;
      // If not a draft and no base, base is current
      setBaseSnapshot({ 
        nodes: workflow.nodes, 
        gates: workflow.gates,
        name: workflow.name,
        description: workflow.description,
        isNonTerminating: workflow.isNonTerminating
      });
    }
  }, [workflow, fetchBaseSnapshot]);

  const handleCommitClick = () => {
    if (!workflow) return;
    setIsCommitDialogOpen(true);
  };

  const handleCommitConfirm = async (label?: string) => {
    console.log("Commit confirmed with label:", label);
    setIsCommitLoading(true);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (response.ok) {
        setSaveStatus({ message: "Changes committed successfully", type: "success" });
        setBaseSnapshot(null); // Force refetch of base
        await fetchWorkflow();
        await fetchHistory();
      } else {
        const data = await response.json();
        setSaveStatus({ 
          message: data.error?.message || "Failed to commit changes", 
          type: "error" 
        });
      }
    } catch (err) {
      console.error("Failed to commit", err);
      setSaveStatus({ message: "Network error while committing", type: "error" });
    } finally {
      setIsCommitLoading(false);
    }
  };

  const handleDiscard = async () => {
    console.log("Discard button clicked");
    if (!window.confirm("Are you sure you want to discard all uncommitted changes? This cannot be undone.")) return;
    
    setIsCommitLoading(true);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/discard`, {
        method: "POST",
      });
      if (response.ok) {
        setSaveStatus({ message: "Changes discarded", type: "success" });
        setBaseSnapshot(null); // Force reset
        handleClearSelection(); // Clear inspector to prevent stale buffer references
        await fetchWorkflow();
      } else {
        const data = await response.json();
        setSaveStatus({ 
          message: data.error?.message || "Failed to discard changes", 
          type: "error" 
        });
      }
    } catch (err) {
      console.error("Failed to discard", err);
      setSaveStatus({ message: "Network error while discarding", type: "error" });
    } finally {
      setIsCommitLoading(false);
    }
  };

  const handleRestore = async (eventId: string) => {
    if (!window.confirm("Restore this version to the builder? Current uncommitted changes will be replaced.")) return;

    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (response.ok) {
        await fetchWorkflow();
        setIsHistoryPanelOpen(false);
      }
    } catch (err) {
      console.error("Failed to restore", err);
    }
  };

  const handleRevertLayout = async () => {
    if (!window.confirm("Revert node positions to the last committed state?")) return;

    try {
      let eventId = workflow?._baseEventId;
      
      if (!eventId) {
        const historyResponse = await fetch(`/api/flowspec/workflows/${workflowId}/history`);
        const historyData = await historyResponse.json();
        const lastCommit = historyData.items?.find((e: any) => e.type === "COMMIT" || e.type === "INITIAL");
        
        if (!lastCommit) {
          alert("No committed layout found to revert to.");
          return;
        }
        eventId = lastCommit.id;
      }

      const eventResponse = await fetch(`/api/flowspec/workflows/${workflowId}/history/${eventId}`);
      const eventData = await eventResponse.json();
      const snapshot = eventData.event.snapshot;
      
      if (snapshot.layout) {
        const positions = snapshot.layout.reduce((acc: any, curr: any) => {
          acc[curr.id] = curr.position;
          return acc;
        }, {});

        const response = await fetch(`/api/flowspec/workflows/${workflowId}/layout/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions }),
        });

        if (response.ok) {
          setSaveStatus({ message: "Layout reverted to last commit", type: "success" });
          await fetchWorkflow();
        } else {
          setSaveStatus({ message: "Failed to revert layout", type: "error" });
        }
      } else {
        alert("No layout data found in the committed snapshot.");
      }
    } catch (err) {
      console.error("Error reverting layout", err);
      setSaveStatus({ message: "Error reverting layout", type: "error" });
    }
  };

  const handleCenterView = () => {
    canvasRef.current?.zoomToFit();
  };
  // --- END SAVE SAFETY ---

  const fetchWorkflow = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/builder`);
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

  const sessionState = useMemo<BuilderSessionState>(() => {
    const status = workflow?.status;
    const isDraft = !!workflow?._isDraft;
    const isPublished = status === "PUBLISHED";
    const isValidated = status === "VALIDATED";
    const isEditable = status === "DRAFT";
    
    const entryNodeCount = workflow?.nodes.filter((n) => n.isEntry).length ?? 0;
    const isLastEntryNode = entryNodeCount === 1;

    return {
      isDraft,
      isPublished,
      isValidated,
      isEditable,
      isLastEntryNode,
      canCommit: isDraft && !isCommitLoading,
      canDiscard: isDraft && !isCommitLoading,
      canValidate: !isValidating && !isPublished,
      canPublish: isValidated && !isPublishing,
      changeCount: semanticDiff.length,
      lastSavedAt: workflow?._bufferUpdatedAt || workflow?.updatedAt
    };
  }, [workflow, semanticDiff, isCommitLoading, isValidating, isPublishing]);

  const selectedNode = workflow?.nodes.find((n) => n.id === selectedNodeId) || null;

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
      <div className="flex flex-col flex-1 min-h-0 relative bg-background" data-density="compact">
        {/* Shared Header Overlay - Fixed at top with z-50 to ensure buttons are never blocked */}
        <div 
          className="fixed top-0 right-0 z-50 p-4 pointer-events-none transition-all duration-300 flex items-start justify-between gap-4"
          style={{ left: collapsed ? '60px' : '240px' }}
        >
          <div className="flex-1 flex justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-2">
              <div className="bg-background/95 backdrop-blur-sm p-4 rounded-xl border shadow-lg max-w-fit flex flex-col items-center">
                <Link href="/flowspec">
                  <Button variant="ghost" size="compact" className="-ml-2 mb-2 self-start">
                    <ArrowLeftIcon className="size-4" />
                    Back to Workflows
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight truncate">{workflow.name}</h1>
                  <WorkflowStatusBadge status={workflow.status} />
                  {workflow.version > 1 && (
                    <span className="text-sm text-muted-foreground">v{workflow.version}</span>
                  )}
                </div>
                {workflow.description && (
                  <p className="text-muted-foreground text-sm truncate mt-1">{workflow.description}</p>
                )}
              </div>

              {/* SAVE SAFETY STATUS STRIP - SECOND ROW */}
              {!sessionState.isPublished && (
                <div className="pointer-events-auto max-w-fit md:max-w-lg">
                  <BuilderSaveStatus 
                    isDirty={sessionState.isDraft}
                    changeCount={sessionState.changeCount}
                    lastSavedAt={sessionState.lastSavedAt}
                    onCommit={handleCommitClick}
                    onDiscard={handleDiscard}
                    onHistory={() => {
                      fetchHistory();
                      setIsHistoryPanelOpen(true);
                    }}
                    onRevertLayout={handleRevertLayout}
                    onCenterView={handleCenterView}
                    isSaving={isCommitLoading}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pointer-events-auto bg-background/95 backdrop-blur-sm p-2 rounded-xl border shadow-lg">
              {/* Validate Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="compact"
                      onClick={handleValidate}
                      disabled={!sessionState.canValidate}
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
                {sessionState.isPublished && (
                  <TooltipContent>
                    Published workflows cannot be modified
                  </TooltipContent>
                )}
              </Tooltip>

              {/* Return to Draft Button (VALIDATED only) */}
              {sessionState.isValidated && (
                <Button
                  variant="outline"
                  size="compact"
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
                      size="compact"
                      onClick={handlePublishClick}
                      disabled={!sessionState.canPublish}
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
                {!sessionState.canPublish && (
                  <TooltipContent>
                    {sessionState.isPublished
                      ? "Workflow is already published"
                      : "Validate workflow before publishing"}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>

          {/* INV-011 Banner for Published Workflows */}
          {sessionState.isPublished && (
            <div className="mt-4 pointer-events-auto flex items-center gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-sm max-w-fit border border-blue-200 shadow-sm">
              <AlertCircleIcon className="size-4" />
              This workflow is published and cannot be modified. Create a new version to make changes.
            </div>
          )}

        {/* Main Content Area - Full Bleed */}
        <div className="flex-1 min-h-0 relative overflow-hidden bg-background">
          {/* Canvas - Primary Surface */}
          <div className="absolute inset-0 z-0" data-testid="workflow-canvas-container">
            <WorkflowCanvas 
              ref={canvasRef}
              nodes={workflow.nodes} 
              gates={workflow.gates} 
              onNodeClick={handleNodeSelect}
              onEdgeClick={handleEdgeSelect}
              onBackgroundClick={handleClearSelection}
              onNodeDragEnd={handleNodeDragEnd}
              selectedNodeId={selectedNodeId}
              selectedEdgeKey={selectedEdgeKey}
            />
          </div>

          {/* Sidebar Toggle (Floating Left) */}
          <div className="absolute top-4 left-4 z-20">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              data-testid="sidebar-toggle"
              title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarExpanded ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
            </Button>
          </div>

          {/* Nodes Sidebar (Overlay Left) */}
          {isSidebarExpanded && (
            <div 
              className="absolute inset-y-0 left-0 w-64 z-10 bg-background/95 backdrop-blur-sm border-r shadow-xl"
              data-testid="nodes-sidebar"
              aria-expanded="true"
            >
              <Card className="h-full border-0 rounded-none overflow-y-auto" variant="compact">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <LayersIcon className="size-4" />
                    Nodes ({workflow.nodes.length})
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {sessionState.isEditable && (
                      <CreateNodeDialog 
                        workflowId={workflowId} 
                        onNodeCreated={fetchWorkflow} 
                      />
                    )}
                    <Button variant="ghost" size="icon-xs" onClick={() => setIsSidebarExpanded(false)}>
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {workflow.nodes.map((node) => {
                      const isHighlighted = highlight?.type === "node" && highlight.nodeId === node.id;
                      return (
                        <button
                          key={node.id}
                          onClick={() => handleNodeSelect(node.id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                            selectedNodeId === node.id
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-muted/50"
                          } ${isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate text-xs">{node.name}</span>
                            {node.isEntry && <FlagIcon className="size-3 text-green-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Inspector Overlay (Sheet) */}
          <Sheet 
            open={!!selectedNodeId || !!selectedEdgeKey} 
            onOpenChange={(open) => {
              if (!open) handleClearSelection();
            }}
          >
          <SheetContent 
            side="right" 
            variant="compact"
            className="w-96 sm:w-[450px] p-0 flex flex-col h-full gap-0"
            data-testid="inspector-root"
          >
            <SheetHeader className="p-4 border-b bg-background flex-none">
              <SheetTitle className="flex items-center justify-between">
                <Label variant="metadata">
                  {selectedNodeId ? "Node Inspector" : "Edge Inspector"}
                </Label>
              </SheetTitle>
              <SheetDescription className="hidden">
                Configuration surface for the selected workflow element.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
                {selectedNodeId && selectedNode && (
                  <div data-testid="node-inspector">
                    <NodeDetailPanel
                      workflowId={workflowId}
                      node={selectedNode}
                      nodes={workflow.nodes}
                      gates={workflow.gates}
                      isEditable={sessionState.isEditable}
                      isLastEntryNode={sessionState.isLastEntryNode && selectedNode.isEntry}
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
                  </div>
                )}

                {selectedEdgeKey && (
                  <div data-testid="edge-inspector-container">
                    {(() => {
                      const [sourceId, outcomeName, targetId] = selectedEdgeKey.split("::");
                      const sourceNode = workflow.nodes.find(n => n.id === sourceId);
                      const targetNode = workflow.nodes.find(n => n.id === targetId) || null;
                      const gate = workflow.gates.find(g => 
                        g.sourceNodeId === sourceId && 
                        g.outcomeName === outcomeName && 
                        (g.targetNodeId === targetId || (g.targetNodeId === null && targetId === "terminal"))
                      );
                      
                      const depthMap = computeNodeDepths(workflow.nodes, workflow.gates);
                      const edgeType = detectEdgeType(sourceId, targetId === "terminal" ? null : targetId, depthMap);

                      if (!sourceNode || !gate) return <p className="text-sm text-muted-foreground">Edge data unavailable</p>;

                      return (
                        <EdgeDetailPanel
                          workflowId={workflowId}
                          gateId={gate.id}
                          sourceNodeId={sourceId}
                          sourceNodeName={sourceNode.name}
                          sourcePosition={sourceNode.position}
                          outcomeName={outcomeName}
                          targetNodeId={gate.targetNodeId}
                          targetNodeName={targetNode?.name || "(Terminal)"}
                          edgeType={edgeType}
                          nodes={workflow.nodes}
                          isEditable={sessionState.isEditable}
                          onUpdated={fetchWorkflow}
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Configuration & Toggle (Floating Bottom Right) */}
          <DraggableResizablePanel
            workflowId={workflowId}
            title="Workflow Configuration"
            isExpanded={isConfigExpanded}
            onExpandedChange={setIsConfigExpanded}
          >
            <RoutingEditor
              workflowId={workflowId}
              nodes={workflow.nodes}
              gates={workflow.gates}
              isEditable={sessionState.isEditable}
              onRoutingUpdated={fetchWorkflow}
              highlightGateId={highlight?.type === "gate" ? highlight.gateId : undefined}
              highlightOutcome={
                highlight?.type === "outcome"
                  ? { nodeId: highlight.nodeId, outcomeName: highlight.outcomeName }
                  : undefined
              }
            />

            <LoopbackIndexPanel
              workflowId={workflowId}
              nodes={workflow.nodes}
              gates={workflow.gates}
            />

            <FanOutRulesEditor
              workflowId={workflowId}
              nodes={workflow.nodes}
              fanOutRules={workflow.fanOutRules}
              isEditable={sessionState.isEditable}
              onRulesUpdated={fetchWorkflow}
            />

            <WorkflowVersionsCard
              workflowId={workflowId}
              versions={versions}
              isLoading={versionsLoading}
              error={versionsError}
            />
          </DraggableResizablePanel>

          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
            <Button
              variant="secondary"
              className="gap-2 shadow-lg"
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              data-testid="config-toggle"
            >
              <SettingsIcon className="size-4" />
              {isConfigExpanded ? "Hide Configuration" : "Show Configuration"}
              {isConfigExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
            </Button>
          </div>
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

        {/* Navigation/Save Status Toast */}
        {(navigationError || saveStatus) && (
          <div className={`fixed bottom-4 right-4 p-3 rounded-md border shadow-lg max-w-sm z-50 transition-all ${
            saveStatus?.type === "success" 
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
          }`}>
            <div className="flex items-center gap-2">
              {saveStatus?.type === "success" ? (
                <CheckCircleIcon className="size-4" />
              ) : (
                <AlertCircleIcon className="size-4" />
              )}
              <span>{navigationError || saveStatus?.message}</span>
            </div>
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

        {/* SAVE SAFETY DIALOGS */}
        <BuilderCommitDialog 
          open={isCommitDialogOpen}
          onOpenChange={setIsCommitDialogOpen}
          changes={semanticDiff}
          onConfirm={handleCommitConfirm}
        />

        <BuilderHistoryPanel 
          open={isHistoryPanelOpen}
          onOpenChange={setIsHistoryPanelOpen}
          history={draftHistory}
          isLoading={isHistoryLoading}
          onRestore={handleRestore}
        />
      </div>
    </TooltipProvider>
  );
}
