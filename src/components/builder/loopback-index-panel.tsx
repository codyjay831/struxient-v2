"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcwIcon, ArrowRightIcon, MapPinIcon } from "lucide-react";
import { getWorkflowLoopbacks } from "@/lib/builder/utils/loopback-detection";
import { useLoopbackMetadata } from "@/components/builder/hooks/useLoopbackMetadata";
import { Badge } from "@/components/ui/badge";

interface Node {
  id: string;
  name: string;
  isEntry: boolean;
}

interface Gate {
  id: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null;
}

interface LoopbackIndexPanelProps {
  workflowId: string;
  nodes: Node[];
  gates: Gate[];
}

/**
 * Loopback Index Panel
 * 
 * Lists all detected loopbacks in the workflow, allowing for quick
 * identification and navigation.
 * 
 * Canon Guardrail:
 * - This is a purely visual tool for the human operator.
 * - It does not affect execution or persistence.
 */
export function LoopbackIndexPanel({
  workflowId,
  nodes,
  gates,
}: LoopbackIndexPanelProps) {
  const loopbacks = useMemo(
    () => getWorkflowLoopbacks({ nodes, gates }),
    [nodes, gates]
  );
  const { metadata } = useLoopbackMetadata(workflowId);

  const getNodeName = (nodeId: string | null) => {
    if (nodeId === null) return "Terminal";
    return nodes.find((n) => n.id === nodeId)?.name || "Unknown";
  };

  if (loopbacks.length === 0) return null;

  return (
    <Card className="mt-6 border-dashed border-amber-200 bg-amber-50/10 dark:border-amber-900/30 dark:bg-amber-900/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-400">
          <RefreshCcwIcon className="size-4" />
          Loopback Index ({loopbacks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {loopbacks.map((l, idx) => {
            const routeKey = `${l.sourceNodeId}:${l.outcomeName}`;
            const userLabel = metadata[routeKey]?.label;

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-md bg-background/50 border border-amber-100 dark:border-amber-900/20 text-xs"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-700 dark:text-amber-500">
                      {userLabel || `Loop ${idx + 1}`}
                    </span>
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[9px] uppercase tracking-tighter opacity-70 border-amber-200 dark:border-amber-900/50"
                    >
                      {l.topologicalDelta === 0
                        ? "Self-Loop"
                        : `${Math.abs(l.topologicalDelta)} Steps Back`}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="truncate max-w-[180px]">
                      {getNodeName(l.sourceNodeId)}
                    </span>
                    <ArrowRightIcon className="size-2.5" />
                    <span className="font-medium text-foreground">
                      {l.outcomeName}
                    </span>
                    <ArrowRightIcon className="size-2.5" />
                    <span className="truncate max-w-[180px] font-semibold text-amber-600/80 dark:text-amber-400/80">
                      {getNodeName(l.targetNodeId)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const el = document.getElementById("routing-editor");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  title="Jump to route in editor"
                  className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors"
                >
                  <MapPinIcon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
