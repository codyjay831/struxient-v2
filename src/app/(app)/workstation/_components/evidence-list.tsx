"use client";

/**
 * Evidence List Component
 * 
 * Canon Source: 30_workstation_ui_api_map.md §4.1.3
 */

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Braces, File, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EvidenceItem {
  id: string;
  type: "FILE" | "TEXT" | "STRUCTURED";
  data: any;
  attachedAt: string;
  attachedBy: string;
}

interface EvidenceListProps {
  flowId: string;
  taskId: string;
  refreshKey?: number;
  onEvidenceCountChange?: (count: number) => void;
}

export function EvidenceList({
  flowId,
  taskId,
  refreshKey,
  onEvidenceCountChange,
}: EvidenceListProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/flowspec/flows/${flowId}/tasks/${taskId}/evidence`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch evidence");
      }
      const data = await response.json();
      const items = data.items || [];
      setEvidence(items);
      onEvidenceCountChange?.(items.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [flowId, taskId, onEvidenceCountChange]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence, refreshKey]);

  if (isLoading && evidence.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading evidence...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive py-2">
        <AlertCircle className="h-4 w-4" />
        Error loading evidence
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-2">
        No evidence attached yet.
      </div>
    );
  }

  const renderSummary = (item: EvidenceItem) => {
    try {
      switch (item.type) {
        case "TEXT":
          const text = item.data?.text || item.data?.content || JSON.stringify(item.data);
          return typeof text === "string" 
            ? text.length > 120 ? `${text.slice(0, 120)}...` : text
            : "Text content";
        case "STRUCTURED":
          const keys = item.data?.content ? Object.keys(item.data.content) : [];
          return `JSON object (${keys.length} keys)`;
        case "FILE":
          return `${item.data?.name || "unnamed"} (${item.data?.mimeType || "unknown"}) • ${item.data?.size || 0} bytes`;
        default:
          return "Evidence data";
      }
    } catch (e) {
      return "Error rendering summary";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "TEXT": return <FileText className="h-4 w-4" />;
      case "STRUCTURED": return <Braces className="h-4 w-4" />;
      case "FILE": return <File className="h-4 w-4" />;
      default: return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3 py-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Attached Evidence ({evidence.length})
      </h4>
      <div className="grid gap-2">
        {evidence.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-md border bg-muted/30 text-sm"
          >
            <div className="mt-0.5 text-muted-foreground">
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase">
                  {item.type}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.attachedAt))} ago
                </span>
              </div>
              <p className="text-muted-foreground break-words leading-relaxed">
                {renderSummary(item)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
