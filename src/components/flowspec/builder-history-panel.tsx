"use client";

import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  HistoryIcon, 
  UserIcon, 
  ClockIcon, 
  DatabaseIcon, 
  RefreshCcwIcon,
  Loader2Icon,
  ChevronRightIcon
} from "lucide-react";

interface DraftEvent {
  id: string;
  seq: number;
  type: "INITIAL" | "COMMIT" | "RESTORE";
  label?: string;
  createdAt: string;
  createdBy: string;
}

interface BuilderHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: DraftEvent[];
  isLoading: boolean;
  onRestore: (eventId: string) => Promise<void>;
}

export function BuilderHistoryPanel({
  open,
  onOpenChange,
  history,
  isLoading,
  onRestore
}: BuilderHistoryPanelProps) {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] p-0 flex flex-col h-full gap-0">
        <SheetHeader className="p-4 border-b bg-background flex-none">
          <div className="flex items-center gap-2 mb-1">
            <HistoryIcon className="size-4 text-muted-foreground" />
            <SheetTitle className="text-sm font-bold uppercase tracking-wider">Save History</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Browse previous versions and restore them to the draft buffer for review.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
              <div className="p-3 rounded-full bg-muted">
                <DatabaseIcon className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No history found</p>
                <p className="text-xs text-muted-foreground">The first save event will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="p-2 space-y-1">
                {history.map((event) => (
                  <div 
                    key={event.id}
                    className="group relative flex flex-col gap-2 p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">#{event.seq}</span>
                          {getTypeBadge(event.type)}
                        </div>
                        <p className="text-sm font-semibold truncate">
                          {event.label || (event.type === "INITIAL" ? "Original State" : `Version ${event.seq}`)}
                        </p>
                      </div>
                      <Button 
                        size="compact" 
                        variant="outline" 
                        className="h-7 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRestore(event.id)}
                      >
                        <RefreshCcwIcon className="size-3" />
                        Restore
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                      <div className="flex items-center gap-1">
                        <UserIcon className="size-3" />
                        {event.createdBy}
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="size-3" />
                        {format(new Date(event.createdAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
