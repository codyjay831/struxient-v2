/**
 * layout.ts
 * 
 * Topology-only layout utilities for the workflow canvas.
 * Strictly non-semantic: does not use outcome names or runtime data.
 */

export interface Node {
  id: string;
  name: string;
  isEntry: boolean;
  nodeKind?: "MAINLINE" | "DETOUR";
  position?: { x: number; y: number } | null;
}

export interface Gate {
  id: string;
  sourceNodeId: string;
  targetNodeId: string | null;
  outcomeName: string;
}

export type EdgeType = "forward" | "loopback" | "self";

/**
 * Computes node depths using BFS starting from entry nodes.
 * Depth represents the shortest topological distance from any entry point.
 */
export function computeNodeDepths(nodes: Node[], gates: Gate[]): Record<string, number> {
  const depths: Record<string, number> = {};
  const queue: string[] = [];

  // Initialize entry nodes
  const entryNodes = nodes.filter(n => n.isEntry);
  for (const node of entryNodes) {
    depths[node.id] = 0;
    queue.push(node.id);
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const currentId = queue[head++];
    const currentDepth = depths[currentId];

    // Find all outgoing gates from this node
    const outgoing = gates.filter(g => g.sourceNodeId === currentId && g.targetNodeId !== null);
    
    for (const gate of outgoing) {
      const targetId = gate.targetNodeId!;
      if (depths[targetId] === undefined) {
        depths[targetId] = currentDepth + 1;
        queue.push(targetId);
      } else {
        // Keep shortest path depth
        depths[targetId] = Math.min(depths[targetId], currentDepth + 1);
      }
    }
  }

  // Mark unreachable nodes with Infinity
  for (const node of nodes) {
    if (depths[node.id] === undefined) {
      depths[node.id] = Infinity;
    }
  }

  return depths;
}

/**
 * Detects the type of an edge based on node depths.
 */
export function detectEdgeType(
  sourceId: string, 
  targetId: string | null, 
  depthMap: Record<string, number>
): EdgeType {
  if (targetId === null) return "forward"; // Terminal
  if (sourceId === targetId) return "self";
  
  const sourceDepth = depthMap[sourceId];
  const targetDepth = depthMap[targetId];

  // If target is closer to entry than source, it's a loopback
  if (targetDepth < sourceDepth && targetDepth !== Infinity) {
    return "loopback";
  }

  return "forward";
}

/**
 * Computes a deterministic spine using a BFS tree approach.
 * Identifies the "longest" branch in the BFS tree.
 * Tie-breaks using alphabetical node ID.
 */
export function computeDeterministicSpine(nodes: Node[], gates: Gate[]): string[] {
  if (nodes.length === 0) return [];

  const depthMap = computeNodeDepths(nodes, gates);
  const entryNodes = nodes.filter(n => n.isEntry).sort((a, b) => a.id.localeCompare(b.id));
  
  if (entryNodes.length === 0) return [];

  // Build a simple tree from BFS depths (ignoring back-edges)
  const childrenMap: Record<string, string[]> = {};
  for (const gate of gates) {
    if (gate.targetNodeId && depthMap[gate.targetNodeId] === depthMap[gate.sourceNodeId] + 1) {
      if (!childrenMap[gate.sourceNodeId]) childrenMap[gate.sourceNodeId] = [];
      if (!childrenMap[gate.sourceNodeId].includes(gate.targetNodeId)) {
        childrenMap[gate.sourceNodeId].push(gate.targetNodeId);
      }
    }
  }

  // Find longest path in this DAG tree
  function getLongestPath(nodeId: string): string[] {
    const children = childrenMap[nodeId] || [];
    if (children.length === 0) return [nodeId];

    let longestChildPath: string[] = [];
    
    // Sort children for determinism
    const sortedChildren = [...children].sort((a, b) => a.localeCompare(b));

    for (const childId of sortedChildren) {
      const path = getLongestPath(childId);
      if (path.length > longestChildPath.length) {
        longestChildPath = path;
      } else if (path.length === longestChildPath.length) {
        // Tie-break: pick the path that is lexicographically smaller
        if (path.join(",") < longestChildPath.join(",")) {
          longestChildPath = path;
        }
      }
    }

    return [nodeId, ...longestChildPath];
  }

  // Start from the first entry node (deterministic)
  return getLongestPath(entryNodes[0].id);
}

/**
 * Generates a canonical, deterministic key for an edge.
 */
export function generateEdgeKey(sourceId: string, outcomeName: string, targetId: string | null): string {
  return `${sourceId}::${outcomeName}::${targetId || "terminal"}`;
}

/**
 * Generates a URL-safe slug for a string (used for data-testids).
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // Replace non-alphanumeric chars with space
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/--+/g, "-"); // Replace multiple - with single -
}

/**
 * Computes the intersection point of a line segment (from center to target)
 * with the perimeter of a rectangle.
 */
export function getPerimeterPoint(
  fromX: number,
  fromY: number,
  rectX: number,
  rectY: number,
  width: number,
  height: number,
  padding = 0
): { x: number; y: number } {
  const centerX = rectX + width / 2;
  const centerY = rectY + height / 2;
  
  const dx = fromX - centerX;
  const dy = fromY - centerY;
  
  if (dx === 0 && dy === 0) return { x: centerX, y: centerY };
  
  const halfWidth = width / 2 + padding;
  const halfHeight = height / 2 + padding;
  
  const scaleX = Math.abs(halfWidth / dx);
  const scaleY = Math.abs(halfHeight / dy);
  
  const scale = Math.min(scaleX, scaleY);
  
  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale
  };
}
