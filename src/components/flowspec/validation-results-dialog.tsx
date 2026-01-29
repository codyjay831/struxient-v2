"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2Icon, XCircleIcon, AlertTriangleIcon, ExternalLinkIcon } from "lucide-react";

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity?: "error" | "warning";
  suggestion?: string;
  category?: string;
}

/**
 * Parsed location from a validation error path.
 * This is the ONLY place that interprets validation location.
 */
export interface ParsedValidationPath {
  nodeIndex?: number;
  taskIndex?: number;
  outcomeName?: string;
  gateIndex?: number;
  isGatesLevel?: boolean; // path is just "gates" without index
}

/**
 * Parse a validation error path into structured location info.
 * Path formats:
 * - "nodes" or "nodes[0]" -> nodeIndex
 * - "nodes[0].tasks[1]" -> nodeIndex, taskIndex
 * - "nodes[0].tasks[1].outcomes[outcomeName]" -> nodeIndex, taskIndex, outcomeName
 * - "nodes[0].gates[0]" -> nodeIndex, gateIndex
 * - "gates" -> isGatesLevel
 */
export function parseValidationPath(path?: string): ParsedValidationPath {
  if (!path) return {};

  const result: ParsedValidationPath = {};

  // Match nodes[index]
  const nodeMatch = path.match(/nodes\[(\d+)\]/);
  if (nodeMatch) {
    result.nodeIndex = parseInt(nodeMatch[1], 10);
  }

  // Match tasks[index]
  const taskMatch = path.match(/tasks\[(\d+)\]/);
  if (taskMatch) {
    result.taskIndex = parseInt(taskMatch[1], 10);
  }

  // Match outcomes[name] - name can be alphanumeric
  const outcomeMatch = path.match(/outcomes\[([^\]]+)\]/);
  if (outcomeMatch) {
    result.outcomeName = outcomeMatch[1];
  }

  // Match gates[index] at node level
  const gateMatch = path.match(/gates\[(\d+)\]/);
  if (gateMatch) {
    result.gateIndex = parseInt(gateMatch[1], 10);
  }

  // Check for top-level "gates" path
  if (path === "gates" || path.startsWith("gates") && !gateMatch) {
    result.isGatesLevel = true;
  }

  return result;
}

interface ValidationResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isValid: boolean;
  errors: ValidationError[];
  onNavigateToIssue?: (error: ValidationError) => void;
}

export function ValidationResultsDialog({
  open,
  onOpenChange,
  isValid,
  errors,
  onNavigateToIssue,
}: ValidationResultsDialogProps) {
  const handleErrorClick = (error: ValidationError) => {
    if (onNavigateToIssue) {
      onNavigateToIssue(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isValid ? (
              <>
                <CheckCircle2Icon className="size-5 text-green-600" />
                Validation Passed
              </>
            ) : (
              <>
                <XCircleIcon className="size-5 text-destructive" />
                Validation Failed
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isValid
              ? "The workflow is valid and ready to be published."
              : `Found ${errors.length} issue${errors.length !== 1 ? "s" : ""} that must be resolved before publishing.`}
          </DialogDescription>
        </DialogHeader>

        {!isValid && errors.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {errors.map((error, index) => {
              const parsed = parseValidationPath(error.path);
              const hasLocation =
                parsed.nodeIndex !== undefined ||
                parsed.isGatesLevel ||
                parsed.gateIndex !== undefined;

              return (
                <button
                  key={index}
                  onClick={() => handleErrorClick(error)}
                  disabled={!hasLocation}
                  className={`w-full text-left flex items-start gap-2 p-3 rounded-md text-sm transition-colors ${
                    hasLocation
                      ? "bg-muted/50 hover:bg-muted cursor-pointer"
                      : "bg-muted/30 cursor-default"
                  }`}
                >
                  <AlertTriangleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{error.code}</p>
                    <p className="text-muted-foreground">{error.message}</p>
                    {error.suggestion && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {error.suggestion}
                      </p>
                    )}
                    {error.path && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {error.path}
                      </p>
                    )}
                  </div>
                  {hasLocation && (
                    <ExternalLinkIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
