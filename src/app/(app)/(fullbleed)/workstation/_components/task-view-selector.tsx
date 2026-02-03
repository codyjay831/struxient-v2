"use client";

import { Button } from "@/components/ui/button";
import type { TaskView } from "../_lib/filter-logic";
import { LayoutGrid, AlertTriangle, Clock, Zap } from "lucide-react";

interface TaskViewSelectorProps {
  currentView: TaskView;
  onViewChange: (view: TaskView) => void;
}

export function TaskViewSelector({ currentView, onViewChange }: TaskViewSelectorProps) {
  const views: { id: TaskView; label: string; icon: any }[] = [
    { id: "all", label: "All Tasks", icon: LayoutGrid },
    { id: "overdue", label: "Overdue", icon: AlertTriangle },
    { id: "dueSoon", label: "Due Soon", icon: Clock },
    { id: "priority", label: "High Priority", icon: Zap },
  ];

  return (
    <div className="flex items-center p-1 bg-muted/50 rounded-lg border w-fit mb-4">
      {views.map((view) => (
        <Button
          key={view.id}
          variant={currentView === view.id ? "default" : "ghost"}
          size="sm"
          className="h-8 px-3 text-xs gap-2"
          onClick={() => onViewChange(view.id)}
        >
          <view.icon className="h-3.5 w-3.5" />
          {view.label}
        </Button>
      ))}
    </div>
  );
}
