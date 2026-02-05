"use client";

import { useMemo, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { 
  Node, 
  Gate, 
  computeNodeDepths, 
  detectEdgeType, 
  computeDeterministicSpine,
  EdgeType,
  generateEdgeKey,
  slugify,
  getPerimeterPoint
} from "@/lib/canvas/layout";

export interface WorkflowCanvasRef {
  zoomToFit: () => void;
}

interface WorkflowCanvasProps {
  nodes: Node[];
  gates: Gate[];
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeKey: string) => void;
  onBackgroundClick?: () => void;
  onNodeDragEnd?: (nodeId: string, position: { x: number; y: number }) => void;
  selectedNodeId?: string | null;
  selectedEdgeKey?: string | null;
  scale?: number; // Injectable for testing
}

export const WorkflowCanvas = forwardRef<WorkflowCanvasRef, WorkflowCanvasProps>(({ 
  nodes, 
  gates, 
  onNodeClick, 
  onEdgeClick, 
  onBackgroundClick,
  onNodeDragEnd,
  selectedNodeId, 
  selectedEdgeKey, 
  scale: initialScale = 1 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Camera State
  const [camera, setCamera] = useState({ x: 0, y: 0, k: initialScale });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef({ x: 0, y: 0 });
  
  // Layout Constants
  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 60;
  const X_GAP = 200;
  const Y_GAP = 100;

  // 1. Compute topology metadata
  const depthMap = useMemo(() => computeNodeDepths(nodes, gates), [nodes, gates]);
  const spine = useMemo(() => computeDeterministicSpine(nodes, gates), [nodes, gates]);

  // 2. Assign coordinates
  const basePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const spineSet = new Set(spine);
    
    // Fill in explicit positions from database first
    nodes.forEach(node => {
      if (node.position) {
        pos[node.id] = { x: node.position.x, y: node.position.y };
      }
    });

    // Position spine nodes along Y=0 (only if not explicitly positioned)
    spine.forEach((id, index) => {
      if (!pos[id]) {
        pos[id] = { x: index * X_GAP, y: 0 };
      }
    });

    // Position non-spine nodes based on their depth and alphabetical order at that depth (only if not explicitly positioned)
    const nonSpineNodes = nodes.filter(n => !spineSet.has(n.id) && !pos[n.id]);
    const nodesByDepth: Record<number, string[]> = {};
    
    nonSpineNodes.forEach(node => {
      const depth = depthMap[node.id];
      if (depth === Infinity) return;
      if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
      nodesByDepth[depth].push(node.id);
    });

    Object.entries(nodesByDepth).forEach(([depthStr, ids]) => {
      const depth = parseInt(depthStr);
      ids.sort().forEach((id, index) => {
        // Offset from spine Y=0. Alternate above/below.
        const yOffset = (index + 1) * Y_GAP * (index % 2 === 0 ? 1 : -1);
        pos[id] = { x: depth * X_GAP, y: yOffset };
      });
    });

    // Handle unreachable nodes at the end (only if not explicitly positioned)
    const unreachable = nodes.filter(n => depthMap[n.id] === Infinity && !pos[n.id]);
    unreachable.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, index) => {
      pos[node.id] = { x: 0, y: (index + 1) * Y_GAP + 300 }; // Far below
    });

    return pos;
  }, [nodes, depthMap, spine]);

  // 2.5 State for manual position overrides
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingCandidateNodeId, setDraggingCandidateNodeId] = useState<string | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD_PX = 5;

  // Interaction Refs (Contract Enforcement)
  const isDraggingRef = useRef(false);
  const isCandidateRef = useRef(false);
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const capturedElementRef = useRef<Element | null>(null);

  // Combine base positions with overrides
  const positions = useMemo(() => {
    const combined = { ...basePositions };
    Object.entries(positionOverrides).forEach(([id, override]) => {
      combined[id] = override;
    });
    return combined;
  }, [basePositions, positionOverrides]);

  // 3. Zoom-to-fit logic
  const zoomToFit = useCallback(() => {
    // Contract: No auto-zoom while user is interacting
    if (isDraggingRef.current || isCandidateRef.current || nodes.length === 0 || !containerRef.current) return;

    const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
    if (containerWidth === 0 || containerHeight === 0) return;

    const coords = Object.values(positions);
    const minX = Math.min(...coords.map(c => c.x)) - 100;
    const minY = Math.min(...coords.map(c => c.y)) - 100;
    const maxX = Math.max(...coords.map(c => c.x)) + NODE_WIDTH + 100;
    const maxY = Math.max(...coords.map(c => c.y)) + NODE_HEIGHT + 100;

    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    
    const k = Math.min(
      containerWidth / worldWidth,
      containerHeight / worldHeight,
      1.25 // Don't over-zoom on small workflows
    );

    const x = (containerWidth - worldWidth * k) / 2 - minX * k;
    const y = (containerHeight - worldHeight * k) / 2 - minY * k;

    setCamera({ x, y, k: Math.max(0.5, Math.min(1.75, k)) });
  }, [nodes, positions, NODE_WIDTH, NODE_HEIGHT]);

  useImperativeHandle(ref, () => ({
    zoomToFit
  }));

  // Stable reference for event listeners and observers
  const zoomToFitRef = useRef(zoomToFit);
  useEffect(() => {
    zoomToFitRef.current = zoomToFit;
  }, [zoomToFit]);

  // Initial fit on mount only
  const hasInitialFit = useRef(false);
  useEffect(() => {
    if (!hasInitialFit.current && nodes.length > 0) {
      zoomToFit();
      hasInitialFit.current = true;
    }
  }, [nodes.length, zoomToFit]);

  // Resize handling and Native Wheel Guard
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Resize Observer (handles sidebar/inspector toggles)
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        zoomToFitRef.current();
      });
      observer.observe(container);
    }

    // 2. Native Wheel Guard (Intercept Pinch-to-Zoom and Block Page Zoom)
    const handleNativeWheel = (e: WheelEvent) => {
      // Contract: No zoom during node drag or candidate press
      if (isDraggingRef.current || isCandidateRef.current) {
        e.preventDefault(); 
        e.stopImmediatePropagation();
        return;
      }

      // Intercept Pinch-to-Zoom (ctrl + wheel)
      if (e.ctrlKey) {
        e.preventDefault();
        
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY;
        const zoomFactor = Math.pow(1.1, delta / 100);

        setCamera(prev => {
          const newK = Math.max(0.5, Math.min(1.75, prev.k * zoomFactor));
          
          // Zoom relative to mouse position
          const worldX = (mouseX - prev.x) / prev.k;
          const worldY = (mouseY - prev.y) / prev.k;
          
          const newX = mouseX - worldX * newK;
          const newY = mouseY - worldY * newK;

          return { x: newX, y: newY, k: newK };
        });
      }
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      observer?.disconnect();
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, []); // Constant throughout lifecycle

  // Interaction Handlers
  const handleWheel = (e: React.WheelEvent) => {
    // Contract: No zoom during node drag or candidate press
    if (isDraggingRef.current || isCandidateRef.current) return;
    
    // Pinch gestures (ctrl+wheel) are handled by the native listener in useEffect
    // to reliably call preventDefault() and block page zoom.
    if (e.ctrlKey) return;

    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY;
    const zoomFactor = Math.pow(1.1, delta / 100);
    
    const newK = Math.max(0.5, Math.min(1.75, camera.k * zoomFactor));
    
    // Zoom relative to mouse position
    const worldX = (mouseX - camera.x) / camera.k;
    const worldY = (mouseY - camera.y) / camera.k;
    
    const newX = mouseX - worldX * newK;
    const newY = mouseY - worldY * newK;

    setCamera({ x: newX, y: newY, k: newK });
  };

  const handleMouseDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Left click only
    
    // Robust pan gating: start pan only if event target is NOT within a node
    // and not currently dragging a node
    const target = e.target as Element;
    const isNode = target.closest('[data-testid="canvas-node"]');
    if (isNode || draggingNodeId || draggingCandidateNodeId) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    cameraStart.current = { x: camera.x, y: camera.y };
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (draggingCandidateNodeId && !isDraggingRef.current) {
      if (pressStartRef.current) {
        const dist = Math.sqrt(
          Math.pow(e.clientX - pressStartRef.current.x, 2) +
          Math.pow(e.clientY - pressStartRef.current.y, 2)
        );
        if (dist > DRAG_THRESHOLD_PX) {
          setDraggingNodeId(draggingCandidateNodeId);
          isDraggingRef.current = true;
          didDragRef.current = true;
        }
      }
    }

    if (isDraggingRef.current && draggingNodeId) {
      const dx = (e.clientX - dragStart.current.x) / camera.k;
      const dy = (e.clientY - dragStart.current.y) / camera.k;
      
      setPositionOverrides(prev => {
        const startPos = basePositions[draggingNodeId] || { x: 0, y: 0 };
        const currentPos = prev[draggingNodeId] || startPos;
        return {
          ...prev,
          [draggingNodeId]: {
            x: currentPos.x + dx,
            y: currentPos.y + dy
          }
        };
      });
      
      dragStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    setCamera(prev => ({
      ...prev,
      x: cameraStart.current.x + dx,
      y: cameraStart.current.y + dy
    }));
  };

  const handleMouseUp = (e: React.PointerEvent) => {
    // Release capture on the element that captured it
    if (capturedElementRef.current && capturedElementRef.current.hasPointerCapture(e.pointerId)) {
      capturedElementRef.current.releasePointerCapture(e.pointerId);
    }
    capturedElementRef.current = null;

    if (didDragRef.current) {
      // Contract: Suppress the immediate click after a real drag
      suppressClickRef.current = true;
      // Clear flag after a short delay so actual clicks still work
      setTimeout(() => { suppressClickRef.current = false; }, 50);
    }

    if (isDraggingRef.current && draggingNodeId) {
      // This was a drag end
      const finalPos = positions[draggingNodeId];
      if (finalPos) {
        onNodeDragEnd?.(draggingNodeId, finalPos);
      }
    }
    
    setIsDragging(false);
    setDraggingNodeId(null);
    setDraggingCandidateNodeId(null);
    isDraggingRef.current = false;
    isCandidateRef.current = false;
    didDragRef.current = false;
    pressStartRef.current = null;
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    // Contract: Bail if a drag just occurred or is suppressed
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onNodeClick?.(nodeId);
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);
    capturedElementRef.current = target;
    
    setDraggingCandidateNodeId(nodeId);
    isCandidateRef.current = true;
    didDragRef.current = false;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  // 4. Render helpers
  const renderEdge = (gate: Gate) => {
    const source = positions[gate.sourceNodeId];
    const target = gate.targetNodeId ? positions[gate.targetNodeId] : null;
    
    if (!source) return null;

    const sourceNode = nodes.find(n => n.id === gate.sourceNodeId);
    const targetNode = gate.targetNodeId ? nodes.find(n => n.id === gate.targetNodeId) : null;

    const isDetourNode = (node: any) => {
      if (!node) return false;
      // Precedence: explicit nodeKind wins if defined
      if (node.nodeKind) {
        return node.nodeKind === "DETOUR";
      }
      // Legacy fallback: only if nodeKind is missing
      return node.name.startsWith("DETOUR:") || node.id.startsWith("ADD_") || node.id.startsWith("CORR_") || node.id.startsWith("FOLLOWUP_");
    };

    const isDetourEntry = !isDetourNode(sourceNode) && isDetourNode(targetNode);
    const isDetourExit = isDetourNode(sourceNode) && !isDetourNode(targetNode);
    const isDetourInternal = isDetourNode(sourceNode) && isDetourNode(targetNode);
    const isDetourEdge = isDetourEntry || isDetourExit || isDetourInternal;

    const edgeType = detectEdgeType(gate.sourceNodeId, gate.targetNodeId, depthMap);
    const key = `edge-${gate.id}`;
    const edgeKey = generateEdgeKey(gate.sourceNodeId, gate.outcomeName, gate.targetNodeId);
    const testId = `canvas-edge-${gate.sourceNodeId}-${slugify(gate.outcomeName)}-${gate.targetNodeId || 'terminal'}`;
    const isSelected = selectedEdgeKey === edgeKey;

    const edgeColor = isSelected ? "text-blue-500" : (isDetourEdge ? "text-muted-foreground/40" : "text-muted-foreground/60");
    const loopColor = isSelected ? "text-blue-500" : "text-primary/40";

    const commonProps = {
      "data-testid": testId,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdgeClick?.(edgeKey);
      },
      className: "cursor-pointer transition-all duration-200"
    };

    if (edgeType === "self") {
      const x = source.x + NODE_WIDTH / 2;
      const y = source.y;
      return (
        <g key={key} {...commonProps}>
          {/* Hit Area */}
          <path
            d={`M ${x - 20} ${y} A 30 30 0 1 1 ${x + 20} ${y}`}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
          />
          {/* Visual Edge */}
          <path
            d={`M ${x - 20} ${y} A 30 30 0 1 1 ${x + 20} ${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={isSelected ? "3" : "2"}
            className={loopColor}
            markerEnd={isSelected ? "url(#arrowhead-special-selected)" : "url(#arrowhead-special)"}
          />
        </g>
      );
    }

    if (!target) {
      return (
        <g key={key} {...commonProps}>
          {/* Hit Area */}
          <line
            x1={source.x + NODE_WIDTH}
            y1={source.y + NODE_HEIGHT / 2}
            x2={source.x + NODE_WIDTH + 40}
            y2={source.y + NODE_HEIGHT / 2}
            stroke="transparent"
            strokeWidth="12"
          />
          {/* Visual Edge */}
          <line
            x1={source.x + NODE_WIDTH}
            y1={source.y + NODE_HEIGHT / 2}
            x2={source.x + NODE_WIDTH + 40}
            y2={source.y + NODE_HEIGHT / 2}
            stroke="currentColor"
            strokeWidth={isSelected ? "3" : "2"}
            className="text-muted-foreground/40"
            markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
          />
        </g>
      );
    }

    const isLoopback = edgeType === "loopback";
    
    // Geometry calculation: anchor points to node perimeters
    let startX = source.x + NODE_WIDTH;
    let startY = source.y + NODE_HEIGHT / 2;
    let endX = target ? target.x : startX + 40;
    let endY = target ? target.y + NODE_HEIGHT / 2 : startY;

    if (isLoopback && target) {
      // For loopbacks, we dip below the nodes. 
      const sCenter = { x: source.x + NODE_WIDTH / 2, y: source.y + NODE_HEIGHT / 2 };
      const tCenter = { x: target.x + NODE_WIDTH / 2, y: target.y + NODE_HEIGHT / 2 };
      
      const dipX = (sCenter.x + tCenter.x) / 2;
      const dipY = Math.max(sCenter.y, tCenter.y) + 120;
      
      const startP = getPerimeterPoint(dipX, dipY, source.x, source.y, NODE_WIDTH, NODE_HEIGHT);
      const endP = getPerimeterPoint(dipX, dipY, target.x, target.y, NODE_WIDTH, NODE_HEIGHT, 6);
      
      startX = startP.x;
      startY = startP.y;
      endX = endP.x;
      endY = endP.y;
    } else if (target) {
      // For forward edges, compute perimeter points for cleaner arrowheads
      const startP = getPerimeterPoint(target.x + NODE_WIDTH/2, target.y + NODE_HEIGHT/2, source.x, source.y, NODE_WIDTH, NODE_HEIGHT);
      const endP = getPerimeterPoint(source.x + NODE_WIDTH/2, source.y + NODE_HEIGHT/2, target.x, target.y, NODE_WIDTH, NODE_HEIGHT, 6);
      startX = startP.x;
      startY = startP.y;
      endX = endP.x;
      endY = endP.y;
    }

    const labelOpacity = camera.k < 0.6 ? 0 : (camera.k - 0.6) / 0.4;

    if (isLoopback) {
      const midX = (startX + endX) / 2;
      const midY = Math.max(startY, endY) + 100;
      return (
        <g key={key} {...commonProps}>
          {/* Hit Area */}
          <path
            d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
          />
          {/* Visual Edge */}
          <path
            d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={isSelected ? "3" : "2"}
            strokeDasharray="5,5"
            className={loopColor}
            markerEnd={isSelected ? "url(#arrowhead-special-selected)" : "url(#arrowhead-special)"}
          />
          {/* Hover/Selection Label */}
          {(isSelected || camera.k > 0.5) && (
            <foreignObject
              x={midX - 60}
              y={midY + 10} // Offset from edge
              width="120"
              height="20"
              className="overflow-visible pointer-events-none"
              style={{ opacity: isSelected ? 1 : labelOpacity }}
            >
              <div className="flex justify-center items-center h-full">
                <span className="px-1.5 py-0.5 rounded bg-card/90 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  ↩ {gate.outcomeName}
                </span>
              </div>
            </foreignObject>
          )}
        </g>
      );
    }

    // Forward Flow
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    return (
      <g key={key} {...commonProps}>
        {/* Hit Area */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="transparent"
          strokeWidth="12"
        />
        {/* Visual Edge */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="currentColor"
          strokeWidth={isSelected ? "3" : "2"}
          strokeDasharray={isDetourEdge ? "5,5" : "none"}
          className={edgeColor}
          markerEnd={isSelected ? "url(#arrowhead-selected)" : undefined}
        />
        {/* Hover/Selection Label */}
        {(isSelected || camera.k > 0.5) && (
          <foreignObject
            x={midX - 60}
            y={midY - 22} // Offset from edge
            width="120"
            height="20"
            className="overflow-visible pointer-events-none"
            style={{ opacity: isSelected ? 1 : labelOpacity }}
          >
            <div className="flex flex-col items-center justify-center h-full gap-1">
              {isDetourEntry && (
                <span className="px-1 py-0.5 rounded bg-blue-500 text-white text-[7px] font-bold uppercase tracking-tighter shadow-sm">
                  Detour
                </span>
              )}
              {isDetourExit && (
                <span className="px-1 py-0.5 rounded bg-green-500 text-white text-[7px] font-bold uppercase tracking-tighter shadow-sm">
                  Resume
                </span>
              )}
              <span className={`px-1.5 py-0.5 rounded bg-card/90 border ${isDetourEdge ? 'border-dashed border-muted-foreground/30' : 'border-border'} text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap shadow-sm backdrop-blur-sm`}>
                {gate.outcomeName}
              </span>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  const isLowZoom = camera.k < 0.6;

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full bg-background canvas-grid relative overflow-hidden select-none touch-none ${isDragging || draggingNodeId ? "cursor-grabbing" : "cursor-default"}`}
      data-testid="workflow-canvas"
      onWheel={handleWheel}
      onPointerDown={handleMouseDown}
      onPointerMove={handleMouseMove}
      onPointerUp={handleMouseUp}
      onPointerLeave={handleMouseUp}
      onPointerCancel={handleMouseUp}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget || (e.target as Element).id === "background-rect") {
          zoomToFit();
        }
      }}
      onClick={(e) => {
        const target = e.target as Element;
        // Guard: only fire background click if click originated from true background
        if (target.closest('[data-testid="canvas-node"]')) return;
        if (target.closest('[data-testid^="canvas-edge-"]')) return;
        onBackgroundClick?.();
      }}
    >
      <svg 
        className="w-full h-full relative z-10"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon 
              points="0 0, 10 3.5, 0 7" 
              fill="currentColor" 
            />
          </marker>
          <marker
            id="arrowhead-selected"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon 
              points="0 0, 10 3.5, 0 7" 
              fill="currentColor"
            />
          </marker>
          <marker
            id="arrowhead-special"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon 
              points="0 0, 10 3.5, 0 7" 
              fill="currentColor" 
              className="text-primary"
              fillOpacity="0.8"
            />
          </marker>
          <marker
            id="arrowhead-special-selected"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon 
              points="0 0, 10 3.5, 0 7" 
              fill="currentColor"
              className="text-primary"
            />
          </marker>
        </defs>

        {/* Background Click Layer (for panning) */}
        <rect 
          id="background-rect"
          width="100%" 
          height="100%" 
          fill="none" 
          pointerEvents="all"
          className="cursor-grab active:cursor-grabbing" 
        />

        {/* Camera Group */}
        <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.k})`}>
          {/* Edges */}
          <g className="edges-layer">
            {gates.map(renderEdge)}
          </g>

          {/* Nodes */}
          <g className="nodes-layer">
            {nodes.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const isActive = spine.includes(node.id);
              const isSelected = selectedNodeId === node.id;

              return (
                <g 
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer group touch-none"
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                  onClick={(e) => handleNodeClick(e, node.id)}
                  data-testid="canvas-node"
                >
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="4"
                    className={`fill-card border transition-all ${
                      isSelected ? "stroke-primary stroke-2 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : 
                      isActive ? "stroke-primary/50" : "stroke-border"
                    } group-hover:stroke-primary`}
                    strokeWidth={isSelected ? "2" : "1"}
                  />
                  
                  {/* Node Label - Hidden at very low zoom or truncated */}
                  {!isLowZoom && (
                    <text
                      x={NODE_WIDTH / 2}
                      y={NODE_HEIGHT / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground text-[11px] font-semibold select-none pointer-events-none"
                      data-zoom-level="detail"
                    >
                      {node.name.length > 18 ? `${node.name.slice(0, 16)}...` : node.name}
                    </text>
                  )}

                  {/* Entry Indicator */}
                  {node.isEntry && (
                    <circle
                      cx="0"
                      cy={NODE_HEIGHT / 2}
                      r="4"
                      className="fill-primary shadow-sm"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Canvas Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 p-3 bg-background/90 backdrop-blur-sm border rounded-md shadow-sm pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5 bg-muted-foreground/60" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Mainline</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5 border-t-2 border-dashed border-muted-foreground/40" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Detour (Compensation)</span>
        </div>
        <div className="mt-1 flex gap-2">
          <span className="px-1 py-0.5 rounded bg-blue-500 text-white text-[7px] font-bold uppercase tracking-tighter">Detour</span>
          <span className="text-[8px] text-muted-foreground">Entry into detour</span>
        </div>
        <div className="flex gap-2">
          <span className="px-1 py-0.5 rounded bg-green-500 text-white text-[7px] font-bold uppercase tracking-tighter">Resume</span>
          <span className="text-[8px] text-muted-foreground">Exit to mainline</span>
        </div>
      </div>
    </div>
  );
});
