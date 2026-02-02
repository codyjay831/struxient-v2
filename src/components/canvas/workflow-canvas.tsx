"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { 
  Node, 
  Gate, 
  computeNodeDepths, 
  detectEdgeType, 
  computeDeterministicSpine,
  EdgeType,
  generateEdgeKey,
  slugify
} from "@/lib/canvas/layout";

interface WorkflowCanvasProps {
  nodes: Node[];
  gates: Gate[];
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeKey: string) => void;
  onBackgroundClick?: () => void;
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
  selectedNodeId,
  selectedEdgeKey,
  scale: initialScale = 1
}: WorkflowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(initialScale);
  
  // Layout Constants
  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 60;
  const X_GAP = 200;
  const Y_GAP = 100;

  // 1. Compute topology metadata
  const depthMap = useMemo(() => computeNodeDepths(nodes, gates), [nodes, gates]);
  const spine = useMemo(() => computeDeterministicSpine(nodes, gates), [nodes, gates]);

  // 2. Assign coordinates
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const spineSet = new Set(spine);
    
    // Position spine nodes along Y=0
    spine.forEach((id, index) => {
      pos[id] = { x: index * X_GAP, y: 0 };
    });

    // Position non-spine nodes based on their depth and alphabetical order at that depth
    const nonSpineNodes = nodes.filter(n => !spineSet.has(n.id));
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

    // Handle unreachable nodes at the end
    const unreachable = nodes.filter(n => depthMap[n.id] === Infinity);
    unreachable.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, index) => {
      pos[node.id] = { x: 0, y: (index + 1) * Y_GAP + 300 }; // Far below
    });

    return pos;
  }, [nodes, depthMap, spine]);

  // 3. Zoom-to-fit calculation
  const [viewBox, setViewBox] = useState("0 0 800 600");

  useEffect(() => {
    if (nodes.length === 0) return;

    const coords = Object.values(positions);
    const minX = Math.min(...coords.map(c => c.x)) - 50;
    const minY = Math.min(...coords.map(c => c.y)) - 50;
    const maxX = Math.max(...coords.map(c => c.x)) + NODE_WIDTH + 50;
    const maxY = Math.max(...coords.map(c => c.y)) + NODE_HEIGHT + 50;

    const width = maxX - minX;
    const height = maxY - minY;
    
    setViewBox(`${minX} ${minY} ${width} ${height}`);
  }, [nodes, positions]);

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
            markerEnd="url(#arrowhead)"
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
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    }

    const isLoopback = edgeType === "loopback";
    const startX = source.x + NODE_WIDTH;
    const startY = source.y + NODE_HEIGHT / 2;
    const endX = target.x;
    const endY = target.y + NODE_HEIGHT / 2;

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
            markerEnd="url(#arrowhead)"
          />
          {/* Hover/Selection Label */}
          {(isSelected || zoom > 0.5) && (
            <foreignObject
              x={midX - 60}
              y={midY - 20}
              width="120"
              height="40"
              className="overflow-visible pointer-events-none"
            >
              <div className="flex justify-center items-center h-full">
                <span className="px-2 py-1 rounded bg-card/90 border border-amber-500/30 text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap shadow-sm backdrop-blur-sm">
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
          markerEnd="url(#arrowhead)"
        />
        {/* Hover/Selection Label */}
        {(isSelected || zoom > 0.5) && (
          <foreignObject
            x={midX - 60}
            y={midY - 25}
            width="120"
            height="40"
            className="overflow-visible pointer-events-none"
          >
            <div className="flex justify-center items-center h-full">
              <span className="px-2 py-1 rounded bg-card/90 border border-border text-[10px] font-bold text-muted-foreground whitespace-nowrap shadow-sm backdrop-blur-sm">
                {gate.outcomeName}
              </span>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  const isLowZoom = zoom < 0.5;

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-background canvas-grid relative overflow-hidden"
      data-testid="workflow-canvas"
      onClick={() => onBackgroundClick?.()}
    >
      <svg 
        viewBox={viewBox} 
        className="w-full h-full relative z-10"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.5" fill="currentColor" className="text-muted-foreground/20" />
          </pattern>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
          </marker>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#grid)" className="pointer-events-none" />

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

            return (
              <g 
                key={node.id} 
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeClick?.(node.id);
                }}
                data-testid="canvas-node"
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="2"
                  className={`fill-card border transition-all ${
                    selectedNodeId === node.id ? "stroke-primary stroke-2 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : 
                    isActive ? "stroke-primary/50" : "stroke-border"
                  } group-hover:stroke-primary`}
                  strokeWidth={selectedNodeId === node.id ? "2" : "1"}
                />
                
                {/* Node Label - Hidden at low zoom */}
                {!isLowZoom && (
                  <text
                    x={NODE_WIDTH / 2}
                    y={NODE_HEIGHT / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-[10px] font-medium select-none pointer-events-none"
                    data-zoom-level="detail"
                  >
                    {node.name}
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
      </svg>
      
      {/* Zoom info for testing */}
      <div className="hidden" data-testid="zoom-level">{zoom}</div>
    </div>
  );
}
