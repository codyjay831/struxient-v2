"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  GitBranchIcon, 
  ArrowRightIcon, 
  RefreshCcwIcon, 
  InfoIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon
} from "lucide-react";
import { EdgeType } from "@/lib/canvas/layout";
import { CreateNextNodeDialog } from "./create-next-node-dialog";

interface EdgeDetailPanelProps {
  workflowId: string;
  sourceNodeId: string;
  sourceNodeName: string;
  sourcePosition?: { x: number; y: number } | null;
  outcomeName: string;
  targetNodeId: string | null;
  targetNodeName: string;
  edgeType: EdgeType;
  nodes: Array<{ id: string; name: string; position?: { x: number; y: number } | null }>;
  isEditable: boolean;
  gateId: string;
  onUpdated: () => void;
}

export function EdgeDetailPanel({
  workflowId,
  sourceNodeId,
  sourceNodeName,
  sourcePosition,
  outcomeName,
  targetNodeId,
  targetNodeName,
  edgeType,
  nodes,
  isEditable,
  gateId,
  onUpdated
}: EdgeDetailPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create next node state
  const [isCreateNextNodeOpen, setIsCreateNextNodeOpen] = useState(false);
  const [createNextNodeMode, setCreateNextNodeMode] = useState<"standard" | "assisted">("standard");

  const handleTargetChange = async (newTargetId: string | null) => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/gates/${gateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetNodeId: newTargetId }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to update route");
      }

      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update route");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="edge-inspector" data-density="compact">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="size-3 text-muted-foreground" />
          <Label variant="metadata">Edge Configuration</Label>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3 rounded-md bg-muted/30 border">
          <div className="text-center space-y-0.5">
            <Label variant="metadata" className="opacity-70">Source</Label>
            <div className="text-xs font-medium truncate">{sourceNodeName}</div>
          </div>
          <ArrowRightIcon className="size-3 text-muted-foreground" />
          <div className="text-center space-y-0.5">
            <Label variant="metadata" className="opacity-70">Target</Label>
            <div className="text-xs font-medium truncate">{targetNodeName}</div>
          </div>
        </div>
      </section>

      <section className="space-y-1">
        <Label variant="metadata">Outcome Name</Label>
        <div className="p-2 rounded-md bg-background border font-mono text-xs">
          {outcomeName}
        </div>
      </section>

      <section className="space-y-1.5">
        <Label variant="metadata">Routing Type</Label>
        <div className="flex items-center gap-2">
          <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
            edgeType === "loopback" 
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              : edgeType === "self"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          }`}>
            {edgeType}
          </div>
        </div>
        
        {edgeType === "loopback" && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30">
            <div className="flex gap-2">
              <InfoIcon className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-normal">
                This edge routes to an earlier node (re-entry). The canvas does not imply state removal. Execution semantics are defined by FlowSpec.
              </p>
            </div>
          </div>
        )}
      </section>

      {isEditable && (
        <section className="space-y-2 pt-3 border-t">
          <Label variant="metadata">Next Node</Label>
          <div className="space-y-1.5">
            <select
              value={targetNodeId ?? "__terminal__"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__create_standard__" || val === "__create_assisted__") {
                  setCreateNextNodeMode(val === "__create_assisted__" ? "assisted" : "standard");
                  setIsCreateNextNodeOpen(true);
                  // Restore select visually
                  e.target.value = targetNodeId ?? "__terminal__";
                  return;
                }
                handleTargetChange(val === "__terminal__" ? null : val);
              }}
              disabled={isUpdating}
              className="w-full h-8 rounded-md border bg-background px-2 text-sm shadow-sm focus:ring-1 focus:ring-ring outline-none disabled:opacity-50"
            >
              <option value="__create_standard__">+ Create next node...</option>
              <option value="__create_assisted__">✨ Assisted create & route...</option>
              <option value="__terminal__">End flow (terminal)</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            {isUpdating && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-0.5">
                <Loader2Icon className="size-3 animate-spin" />
                Updating orientation...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-[10px] text-destructive px-0.5">
                <AlertCircleIcon className="size-3" />
                {error}
              </div>
            )}
          </div>
        </section>
      )}

      {!isEditable && (
        <div className="p-3 rounded-md bg-muted/50 border border-dashed text-center">
          <p className="text-[9px] text-muted-foreground uppercase font-bold italic">
            Routing is read-only for published workflows
          </p>
        </div>
      )}

      {/* Create Next Node Dialog */}
      <CreateNextNodeDialog
        workflowId={workflowId}
        sourceNodeId={sourceNodeId}
        sourceNodeName={sourceNodeName}
        outcomeName={outcomeName}
        sourcePosition={sourcePosition}
        open={isCreateNextNodeOpen}
        onOpenChange={setIsCreateNextNodeOpen}
        onCreated={() => {
          onUpdated();
          setIsCreateNextNodeOpen(false);
        }}
        mode={createNextNodeMode}
      />
    </div>
  );
}
