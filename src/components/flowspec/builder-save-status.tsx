"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CloudUploadIcon, 
  RotateCcwIcon, 
  HistoryIcon, 
  AlertCircleIcon,
  CheckCircleIcon,
  MaximizeIcon
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface BuilderSaveStatusProps {
  isDirty: boolean;
  changeCount: number;
  lastSavedAt?: string | Date;
  onCommit: () => void;
  onDiscard: () => void;
  onHistory: () => void;
  onRevertLayout: () => void;
  onCenterView: () => void;
  isSaving?: boolean;
}

export function BuilderSaveStatus({
  isDirty,
  changeCount,
  lastSavedAt,
  onCommit,
  onDiscard,
  onHistory,
  onRevertLayout,
  onCenterView,
  isSaving
}: BuilderSaveStatusProps) {
  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 px-3 py-1.5 bg-background/95 backdrop-blur-sm rounded-full border border-border/50 text-[11px] font-medium transition-all shadow-sm">
      {/* Dirty Indicator */}
      <div className="flex items-center gap-2 pr-3 border-r border-border/50">
        {isDirty ? (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 animate-pulse">
            <AlertCircleIcon className="size-3" />
            <span>{changeCount} unsaved changes</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircleIcon className="size-3 text-green-600" />
            <span>All changes committed</span>
          </div>
        )}
      </div>

      {/* Last Saved */}
      {lastSavedAt && (
        <div className="text-muted-foreground hidden sm:block">
          Last saved {formatDistanceToNow(new Date(lastSavedAt), { addSuffix: true })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant={isDirty ? "default" : "ghost"} 
              size="icon-xs" 
              className="h-6 w-16 gap-1 px-2"
              onClick={onCommit}
              disabled={!isDirty || isSaving}
            >
              <CloudUploadIcon className="size-3" />
              Commit
            </Button>
          </TooltipTrigger>
          <TooltipContent>Review and save semantic changes</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon-xs" 
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={onDiscard}
              disabled={!isDirty || isSaving}
            >
              <RotateCcwIcon className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Discard uncommitted changes</TooltipContent>
        </Tooltip>

        <div className="w-px h-3 bg-border/50 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon-xs" 
              className="h-6 w-6 text-muted-foreground"
              onClick={onHistory}
            >
              <HistoryIcon className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>View version history (Time Machine)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon-xs" 
              className="h-6 w-6 text-muted-foreground"
              onClick={onRevertLayout}
            >
              <RotateCcwIcon className="size-3 rotate-180" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Revert node positions to last commit</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon-xs" 
              className="h-6 w-6 text-muted-foreground"
              onClick={onCenterView}
            >
              <MaximizeIcon className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Center and fit view</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
