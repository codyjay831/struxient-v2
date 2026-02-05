"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CloudUploadIcon, 
  RotateCcwIcon, 
  HistoryIcon, 
  MaximizeIcon,
  DatabaseIcon,
  UserIcon,
  ClockIcon,
  RefreshCcwIcon,
  Loader2Icon,
  InfoIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DraftEvent {
  id: string;
  seq: number;
  type: "INITIAL" | "COMMIT" | "RESTORE";
  label?: string;
  createdAt: string;
  createdBy: string;
}

interface BuilderSessionSidebarProps {
  isDraft: boolean;
  changeCount: number;
  lastSavedAt?: string | Date;
  baseEventId?: string | null;
  history: DraftEvent[];
  isHistoryLoading: boolean;
  isSaving: boolean;
  onCommit: () => void;
  onDiscard: () => void;
  onRestore: (eventId: string) => Promise<void>;
  onRevertLayout: () => void;
  onCenterView: () => void;
}

export function BuilderSessionSidebar({
  isDraft,
  changeCount,
  lastSavedAt,
  baseEventId,
  history,
  isHistoryLoading,
  isSaving,
  onCommit,
  onDiscard,
  onRestore,
  onRevertLayout,
  onCenterView
}: BuilderSessionSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("struxient-session-sidebar-collapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  const handleToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("struxient-session-sidebar-collapsed", String(next));
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "INITIAL":
        return <Badge variant="outline" className="text-[10px] h-4">Initial</Badge>;
      case "RESTORE":
        return <Badge variant="secondary" className="text-[10px] h-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-none">Restore</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-none">Commit</Badge>;
    }
  };

  // Render a simple placeholder during hydration to avoid mismatch
  if (!isMounted) {
    return <div className="w-[320px] md:w-[350px] border-l bg-muted/30 h-full" />;
  }

  return (
    <div 
      className={cn(
        "h-full border-l bg-muted/30 flex flex-col pointer-events-auto z-40 relative transition-all duration-300 ease-in-out group/sidebar overflow-hidden",
        isCollapsed ? "w-[40px]" : "w-[320px] md:w-[350px]"
      )}
    >
      {/* COLLAPSED RAIL AFFORDANCE / TOGGLE */}
      {isCollapsed && (
        <div 
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Open session panel"
          className="absolute inset-0 flex flex-col items-center py-4 cursor-pointer hover:bg-muted/50 transition-colors z-50 group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-6 h-full w-full">
                  <div className="p-2 text-muted-foreground group-hover:text-foreground transition-colors">
                    <ChevronLeftIcon className="size-4" />
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 -rotate-90 whitespace-nowrap">
                      Draft & History
                    </span>
                  </div>
                  
                  <div className="p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <HistoryIcon className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">Open session panel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* EXPANDED CONTENT */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 h-full transition-all duration-300",
        isCollapsed ? "opacity-0 pointer-events-none translate-x-8" : "opacity-100 translate-x-0"
      )}>
        {/* SECTION A: DRAFT / SAVE */}
        <div className="p-4 border-b bg-background/50 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <DatabaseIcon className="size-3" />
              Draft & Session
            </h3>
            
            <div className="space-y-4">
              <div className="p-3 rounded-lg border bg-background flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Status</span>
                  {isDraft ? (
                    <Badge variant="outline" className="text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 gap-1">
                      <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                      Unsaved Changes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 gap-1">
                      <CheckCircleIcon className="size-3" />
                      Synced
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Modifications</span>
                  <span className="font-mono">{changeCount} items</span>
                </div>

                {lastSavedAt && (
                  <div className="text-[10px] text-muted-foreground italic text-right">
                    Last autosave: {formatDistanceToNow(new Date(lastSavedAt), { addSuffix: true })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button 
                  className="w-full justify-start gap-2" 
                  onClick={onCommit}
                  disabled={!isDraft || isSaving}
                >
                  <CloudUploadIcon className="size-4" />
                  Commit Changes
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive" 
                  onClick={onDiscard}
                  disabled={!isDraft || isSaving}
                >
                  <RotateCcwIcon className="size-4" />
                  Discard Draft
                </Button>
              </div>

              {baseEventId && (
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-[10px] text-muted-foreground">
                  <InfoIcon className="size-3 flex-shrink-0" />
                  <p>Draft is based on event <span className="font-mono text-[9px]">{baseEventId.substring(0, 8)}</span></p>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 -mr-2 -mt-1 text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleToggle}
            title="Collapse panel"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        {/* SECTION B: REVISION HISTORY */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <HistoryIcon className="size-3" />
              Revision History
            </h3>
            {isHistoryLoading && <Loader2Icon className="size-3 animate-spin text-muted-foreground" />}
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {isHistoryLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground/30" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-xs text-muted-foreground italic">No version history yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {history.map((event) => (
                  <div 
                    key={event.id}
                    className="group relative flex flex-col gap-2 p-3 rounded-lg border border-transparent hover:border-border hover:bg-background transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground">#{event.seq}</span>
                          {getTypeBadge(event.type)}
                        </div>
                        <p className="text-xs font-semibold truncate">
                          {event.label || (event.type === "INITIAL" ? "Original State" : `Version ${event.seq}`)}
                        </p>
                      </div>
                      <Button 
                        size="compact" 
                        variant="outline" 
                        className="h-6 px-2 text-[9px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRestore(event.id)}
                      >
                        <RefreshCcwIcon className="size-2.5" />
                        Restore
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <UserIcon className="size-2.5" />
                      <span className="truncate">{event.createdBy}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <ClockIcon className="size-2.5" />
                      <span>{format(new Date(event.createdAt), "MMM d, HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION C: LAYOUT & VIEW TOOLS */}
        <div className="p-4 border-t bg-muted/50 mt-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <MaximizeIcon className="size-3" />
            Layout & View
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="compact" 
                    className="h-8 text-[11px] gap-1.5"
                    onClick={onRevertLayout}
                  >
                    <RotateCcwIcon className="size-3" />
                    Revert Layout
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Revert nodes to last committed positions</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="compact" 
                    className="h-8 text-[11px] gap-1.5"
                    onClick={onCenterView}
                  >
                    <MaximizeIcon className="size-3" />
                    Fit Canvas
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Center and zoom to fit all nodes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
