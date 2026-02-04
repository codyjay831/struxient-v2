"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskDetailPanel } from "./task-detail-panel";
import {
  ListTodoIcon,
  GripVerticalIcon,
  ClipboardCheckIcon,
  AlertCircleIcon,
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

interface Gate {
  id: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null;
}

interface TaskListPanelProps {
  workflowId: string;
  nodeId: string;
  nodeName: string;
  tasks: Task[];
  nodes: any[];
  gates: Gate[];
  isEditable: boolean;
  onTasksUpdated: () => void;
  // Highlight props for validation navigation
  highlightTaskId?: string;
  highlightOutcome?: { taskId?: string; outcomeName?: string };
}

export function TaskListPanel({
  workflowId,
  nodeId,
  nodeName,
  tasks,
  nodes,
  gates,
  isEditable,
  onTasksUpdated,
  highlightTaskId,
  highlightOutcome,
}: TaskListPanelProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Auto-select task when highlight changes
  useEffect(() => {
    if (highlightTaskId) {
      setSelectedTaskId(highlightTaskId);
    } else if (highlightOutcome?.taskId) {
      setSelectedTaskId(highlightOutcome.taskId);
    }
  }, [highlightTaskId, highlightOutcome?.taskId]);
  const [localTasks, setLocalTasks] = useState<Task[]>(() =>
    [...tasks].sort((a, b) => a.displayOrder - b.displayOrder)
  );
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Sync local tasks when tasks prop changes
  if (tasks.length !== localTasks.length || 
      tasks.some((t, i) => {
        const sorted = [...tasks].sort((a, b) => a.displayOrder - b.displayOrder);
        return sorted[i]?.id !== localTasks[i]?.id;
      })) {
    setLocalTasks([...tasks].sort((a, b) => a.displayOrder - b.displayOrder));
  }

  const selectedTask = localTasks.find((t) => t.id === selectedTaskId) || null;

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    // Reorder locally first for optimistic UI
    const newTasks = [...localTasks];
    const draggedTask = newTasks[dragItem.current];
    newTasks.splice(dragItem.current, 1);
    newTasks.splice(dragOverItem.current, 0, draggedTask);

    const previousTasks = [...localTasks];
    setLocalTasks(newTasks);

    dragItem.current = null;
    dragOverItem.current = null;

    // Call API to persist reorder
    setIsReordering(true);
    setReorderError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: newTasks.map((t) => t.id),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to reorder tasks");
      }

      // Refresh from server to ensure consistency
      onTasksUpdated();
    } catch (err) {
      // Revert on error
      setLocalTasks(previousTasks);
      setReorderError(err instanceof Error ? err.message : "Failed to reorder tasks");
    } finally {
      setIsReordering(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleTaskDeleted = () => {
    setSelectedTaskId(null);
    onTasksUpdated();
  };

  return (
    <div className="space-y-4">
      {/* Task List */}
      <Card variant="compact">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ListTodoIcon className="size-4" />
              <Label variant="metadata">Tasks in "{nodeName}"</Label>
              <span className="text-[10px] font-normal text-muted-foreground">
                ({localTasks.length})
              </span>
            </CardTitle>
            {isEditable && (
              <CreateTaskDialog
                workflowId={workflowId}
                nodeId={nodeId}
                onTaskCreated={onTasksUpdated}
                disabled={!isEditable}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reorderError && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm mb-3">
              <AlertCircleIcon className="size-4 shrink-0" />
              {reorderError}
            </div>
          )}

          {localTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks in this node.
              {isEditable && " Click \"Add Task\" to create one."}
            </p>
          ) : (
            <div className="space-y-1">
              {localTasks.map((task, index) => {
                const isHighlighted = highlightTaskId === task.id;
                return (
                <div
                  key={task.id}
                  draggable={isEditable && !isReordering}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all ${
                    selectedTaskId === task.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  } ${isReordering ? "opacity-50" : ""} ${
                    isHighlighted ? "ring-2 ring-amber-500 ring-offset-2" : ""
                  }`}
                >
                  {/* Drag Handle */}
                  {isEditable && (
                    <div
                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                      title="Drag to reorder"
                    >
                      <GripVerticalIcon className="size-4" />
                    </div>
                  )}

                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {task.name}
                      </span>
                      {task.evidenceRequired && (
                        <span title="Evidence required">
                          <ClipboardCheckIcon
                            className="size-3 text-blue-600 shrink-0"
                          />
                        </span>
                      )}
                    </div>
                    {task.instructions && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.instructions}
                      </p>
                    )}
                  </div>

                  {/* Outcomes count */}
                  {task.outcomes.length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {task.outcomes.length} outcome{task.outcomes.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {isEditable && localTasks.length > 1 && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Drag tasks to reorder them
            </p>
          )}
        </CardContent>
      </Card>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          workflowId={workflowId}
          nodeId={nodeId}
          task={selectedTask}
          nodes={nodes}
          gates={gates}
          isEditable={isEditable}
          onTaskUpdated={onTasksUpdated}
          onTaskDeleted={handleTaskDeleted}
          onClose={() => setSelectedTaskId(null)}
          highlightOutcomeName={
            highlightOutcome?.taskId === selectedTask.id
              ? highlightOutcome.outcomeName
              : undefined
          }
        />
      )}
    </div>
  );
}
