"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
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

export function WorkflowCanvas({ 
  nodes, 
  gates, 
  onNodeClick, 
  onEdgeClick, 
  onBackgroundClick,
  onNodeDragEnd,
  selectedNodeId, 
  selectedEdgeKey, 
  scale: initialScale = 1 
}: WorkflowCanvasProps) {
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
    if (nodes.length === 0 || !containerRef.current) return;

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

  // Initial zoom to fit and resize handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial fit
    zoomToFit();

    // Re-fit on container resize (handles sidebar/inspector toggles)
    // Guard for environments without ResizeObserver (e.g., JSDOM tests)
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      zoomToFit();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [zoomToFit]);

  // Interaction Handlers
  const handleWheel = (e: React.WheelEvent) => {
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
    if (draggingCandidateNodeId && !draggingNodeId) {
      if (pressStartRef.current) {
        const dist = Math.sqrt(
          Math.pow(e.clientX - pressStartRef.current.x, 2) +
          Math.pow(e.clientY - pressStartRef.current.y, 2)
        );
        if (dist > DRAG_THRESHOLD_PX) {
          setDraggingNodeId(draggingCandidateNodeId);
        }
      }
    }

    if (draggingNodeId) {
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
    if (draggingCandidateNodeId && !draggingNodeId) {
      // This was a click, not a drag
      onNodeClick?.(draggingCandidateNodeId);
    } else if (draggingNodeId) {
      // This was a drag end
      const finalPos = positions[draggingNodeId];
      if (finalPos) {
        onNodeDragEnd?.(draggingNodeId, finalPos);
      }
    }
    
    setIsDragging(false);
    setDraggingNodeId(null);
    setDraggingCandidateNodeId(null);
    pressStartRef.current = null;
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (e.button !== 0) return; // Left click only
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    
    setDraggingCandidateNodeId(nodeId);
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  // 4. Render helpers
  const renderEdge = (gate: Gate) => {
    const source = positions[gate.sourceNodeId];
    const target = gate.targetNodeId ? positions[gate.targetNodeId] : null;
    
    if (!source) return null;

    const edgeType = detectEdgeType(gate.sourceNodeId, gate.targetNodeId, depthMap);
    const key = `edge-${gate.id}`;
    const edgeKey = generateEdgeKey(gate.sourceNodeId, gate.outcomeName, gate.targetNodeId);
    const testId = `canvas-edge-${gate.sourceNodeId}-${slugify(gate.outcomeName)}-${gate.targetNodeId || 'terminal'}`;
    const isSelected = selectedEdgeKey === edgeKey;

    const edgeColor = isSelected ? "text-blue-500" : "text-muted-foreground/60";
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
      // We compute perimeter points relative to this dip point so the curve
      // enters/leaves the nodes at the correct angle.
      const sCenter = { x: source.x + NODE_WIDTH / 2, y: source.y + NODE_HEIGHT / 2 };
      const tCenter = { x: target.x + NODE_WIDTH / 2, y: target.y + NODE_HEIGHT / 2 };
      
      const dipX = (sCenter.x + tCenter.x) / 2;
      const dipY = Math.max(sCenter.y, tCenter.y) + 120;
      
      // Padding of 6px on target perimeter to keep arrowhead tip outside node border
      const startP = getPerimeterPoint(dipX, dipY, source.x, source.y, NODE_WIDTH, NODE_HEIGHT);
      const endP = getPerimeterPoint(dipX, dipY, target.x, target.y, NODE_WIDTH, NODE_HEIGHT, 6);
      
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
          className={edgeColor}
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
            <div className="flex justify-center items-center h-full">
              <span className="px-1.5 py-0.5 rounded bg-card/90 border border-border text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap shadow-sm backdrop-blur-sm">
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
      className={`w-full h-full bg-background canvas-grid relative overflow-hidden select-none ${isDragging || draggingNodeId ? "cursor-grabbing" : "cursor-default"}`}
      data-testid="workflow-canvas"
      onWheel={handleWheel}
      onPointerDown={handleMouseDown}
      onPointerMove={handleMouseMove}
      onPointerUp={handleMouseUp}
      onPointerLeave={handleMouseUp}
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
                  className="cursor-pointer group"
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
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
    </div>
  );
}
