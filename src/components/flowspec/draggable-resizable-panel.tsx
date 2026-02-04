"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { SettingsIcon, ChevronDownIcon, GripHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraggableResizablePanelProps {
  workflowId: string;
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  defaultWidth?: number;
  defaultHeight?: number;
}

interface PanelState {
  v: number;
  x: number | null; // null means not yet positioned (use default)
  y: number | null;
  w: number;
  h: number;
}

const STORAGE_VERSION = 2; // Migrated from 1 for manual resize logic
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;

export function DraggableResizablePanel({
  workflowId,
  title,
  children,
  isExpanded,
  onExpandedChange,
  defaultWidth = 600,
  defaultHeight = 400,
}: DraggableResizablePanelProps) {
  const [state, setState] = useState<PanelState>({
    v: STORAGE_VERSION,
    x: null,
    y: null,
    w: defaultWidth,
    h: defaultHeight,
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const activeResizeType = useRef<"right" | "bottom" | "corner" | null>(null);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const panelStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const storageKey = `flowspec:workflow-config-panel:${workflowId}`;

  // Load state from localStorage with migration
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.v === 1) {
          // Migration from v1 to v2
          const migrated = { ...parsed, v: STORAGE_VERSION };
          setState(migrated);
          localStorage.setItem(storageKey, JSON.stringify(migrated));
        } else if (parsed.v === STORAGE_VERSION) {
          setState(parsed);
        }
      } catch (e) {
        console.error("Failed to parse panel state", e);
      }
    }
  }, [storageKey]);

  // Save state to localStorage
  const saveState = useCallback((newState: PanelState) => {
    localStorage.setItem(storageKey, JSON.stringify(newState));
  }, [storageKey]);

  const handleDragDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      panelStart.current = {
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height
      };
    }
  };

  const handleResizeDown = (e: React.PointerEvent, type: "right" | "bottom" | "corner") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    activeResizeType.current = type;
    dragStart.current = { x: e.clientX, y: e.clientY };
    
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      panelStart.current = {
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current && !activeResizeType.current) return;
    e.stopPropagation();

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (isDragging.current) {
      const newX = panelStart.current.x + dx;
      const newY = panelStart.current.y + dy;
      
      const clampedX = Math.max(0, Math.min(window.innerWidth - state.w, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - state.h, newY));

      setState(prev => ({ ...prev, x: clampedX, y: clampedY }));
    } else if (activeResizeType.current) {
      const type = activeResizeType.current;
      const newState = { ...state };

      if (type === "right" || type === "corner") {
        const newW = panelStart.current.w + dx;
        newState.w = Math.max(MIN_WIDTH, Math.min(window.innerWidth - (state.x ?? 0) - 16, newW));
      }

      if (type === "bottom" || type === "corner") {
        const newH = panelStart.current.h + dy;
        newState.h = Math.max(MIN_HEIGHT, Math.min(window.innerHeight - (state.y ?? 0) - 16, newH));
      }

      setState(newState);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current && !activeResizeType.current) return;
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }

    isDragging.current = false;
    activeResizeType.current = null;
    saveState(state);
  };

  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 40,
    width: `${state.w}px`,
    height: `${state.h}px`,
    minWidth: `${MIN_WIDTH}px`,
    minHeight: `${MIN_HEIGHT}px`,
    maxWidth: "calc(100vw - 2rem)",
    maxHeight: "calc(100vh - 2rem)",
    // Native resize disabled per Option A
    resize: "none",
    overflow: "visible", // Allow resizer hit zones to extend beyond border
  };

  if (state.x !== null && state.y !== null) {
    style.left = `${state.x}px`;
    style.top = `${state.y}px`;
    style.right = "auto";
    style.bottom = "auto";
  } else {
    style.right = "1rem";
    style.bottom = "5rem";
  }

  if (!isExpanded) return null;

  return (
    <div
      ref={panelRef}
      style={style}
      className="flex flex-col bg-background/95 backdrop-blur-sm border rounded-lg shadow-2xl"
      data-testid="config-panel"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header / Drag Handle */}
      <div
        className="flex justify-between items-center p-3 border-b bg-muted/30 cursor-move select-none shrink-0"
        onPointerDown={handleDragDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <h3 className="text-sm font-bold flex items-center gap-2">
          <SettingsIcon className="size-4" />
          {title}
        </h3>
        <div className="flex items-center gap-1">
          <GripHorizontalIcon className="size-4 text-muted-foreground/40" />
          <Button 
            variant="ghost" 
            size="icon-xs" 
            onClick={(e) => {
              e.stopPropagation();
              onExpandedChange(false);
            }}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
        {children}
      </div>

      {/* Right Edge Resizer */}
      <div
        data-testid="resizer-right"
        className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize z-50 touch-none"
        onPointerDown={(e) => handleResizeDown(e, "right")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Bottom Edge Resizer */}
      <div
        data-testid="resizer-bottom"
        className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize z-50 touch-none"
        onPointerDown={(e) => handleResizeDown(e, "bottom")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Bottom-Right Corner Resizer */}
      <div
        data-testid="resizer-corner"
        className="absolute -bottom-2 -right-2 w-4 h-4 cursor-nwse-resize z-50 touch-none"
        onPointerDown={(e) => handleResizeDown(e, "corner")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
