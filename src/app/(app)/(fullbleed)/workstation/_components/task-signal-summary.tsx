"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Zap, List } from "lucide-react";
import type { ActionableTask } from "./task-feed";
import type { SignalFilters, TaskView } from "../_lib/filter-logic";

interface TaskSignalSummaryProps {
  tasks: ActionableTask[];
  filters: SignalFilters;
  onToggleOverdue: () => void;
  onTogglePriority: () => void;
  onViewChange?: (view: TaskView) => void;
  onClearFilters: () => void;
}

export function TaskSignalSummary({
  tasks,
  filters,
  onToggleOverdue,
  onTogglePriority,
  onViewChange,
  onClearFilters,
}: TaskSignalSummaryProps) {
  const counts = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.total++;
        if (task._signals?.isOverdue) {
          acc.overdue++;
        } else if (task._signals?.isDueSoon) {
          acc.dueSoon++;
        }

        if (
          task._signals?.jobPriority === "HIGH" ||
          task._signals?.jobPriority === "URGENT"
        ) {
          acc.priority++;
        }
        return acc;
      },
      { total: 0, overdue: 0, dueSoon: 0, priority: 0 }
    );
  }, [tasks]);

  const hasActiveSignalFilters = filters.showOverdueOnly || filters.showHighPriorityOnly;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {/* Total Card */}
      <Card 
        className={`cursor-pointer transition-all hover:border-primary/50 ${(!hasActiveSignalFilters && filters.view === 'all') ? 'border-primary shadow-sm bg-primary/5' : 'bg-muted/30'}`}
        onClick={onClearFilters}
      >
        <CardContent className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Ready</p>
            <p className="text-xl font-bold">{counts.total}</p>
          </div>
          <List className="h-4 w-4 text-muted-foreground/50" />
        </CardContent>
      </Card>

      {/* Overdue Card */}
      <Card 
        className={`cursor-pointer transition-all hover:border-destructive/50 ${filters.view === 'overdue' ? 'border-destructive shadow-sm bg-destructive/5' : 'bg-muted/30'}`}
        onClick={() => onViewChange?.("overdue")}
      >
        <CardContent className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Overdue</p>
            <div className="flex items-center gap-1.5">
              <p className={`text-xl font-bold ${counts.overdue > 0 ? 'text-destructive' : ''}`}>{counts.overdue}</p>
              {counts.overdue > 0 && <Badge variant="destructive" className="h-4 px-1 text-[8px] animate-pulse">Action Required</Badge>}
            </div>
          </div>
          <AlertTriangle className={`h-4 w-4 ${counts.overdue > 0 ? 'text-destructive' : 'text-muted-foreground/50'}`} />
        </CardContent>
      </Card>

      {/* Due Soon Card */}
      <Card 
        className={`cursor-pointer transition-all hover:border-amber-500/50 ${filters.view === 'dueSoon' ? 'border-amber-500 shadow-sm bg-amber-500/5' : 'bg-muted/30'}`}
        onClick={() => onViewChange?.("dueSoon")}
      >
        <CardContent className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Due Soon</p>
            <p className={`text-xl font-bold ${counts.dueSoon > 0 ? 'text-amber-600' : ''}`}>{counts.dueSoon}</p>
          </div>
          <Clock className={`h-4 w-4 ${counts.dueSoon > 0 ? 'text-amber-600' : 'text-muted-foreground/50'}`} />
        </CardContent>
      </Card>

      {/* Priority Card */}
      <Card 
        className={`cursor-pointer transition-all hover:border-blue-500/50 ${filters.view === 'priority' ? 'border-blue-500 shadow-sm bg-blue-500/5' : 'bg-muted/30'}`}
        onClick={() => onViewChange?.("priority")}
      >
        <CardContent className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">High/Urgent</p>
            <p className={`text-xl font-bold ${counts.priority > 0 ? 'text-blue-600' : ''}`}>{counts.priority}</p>
          </div>
          <Zap className={`h-4 w-4 ${counts.priority > 0 ? 'text-blue-600' : 'text-muted-foreground/50'}`} />
        </CardContent>
      </Card>
    </div>
  );
}
