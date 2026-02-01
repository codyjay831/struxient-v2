import { WorkflowWithRelations } from "../../flowspec/types";

export interface LoopbackContext {
  sourceNodeId: string;
  targetNodeId: string;
  outcomeName: string;
  topologicalDelta: number;
}

/**
 * Node-like interface to allow the utility to work with both
 * WorkflowWithRelations and WorkflowSnapshot if needed.
 */
interface NodeLike {
  id: string;
  isEntry: boolean;
}

interface GateLike {
  sourceNodeId: string;
  targetNodeId: string | null;
  outcomeName: string;
}

interface WorkflowLike {
  nodes: NodeLike[];
  gates: GateLike[];
}

/**
 * Computes topological depth for all nodes in a workflow using BFS starting from entry nodes.
 * Depth is the shortest path from any entry node.
 */
function computeNodeDepths(workflow: WorkflowLike): Map<string, number> {
  const depths = new Map<string, number>();
  const queue: string[] = [];

  // Initialize with entry nodes
  workflow.nodes.forEach((node) => {
    if (node.isEntry) {
      depths.set(node.id, 0);
      queue.push(node.id);
    }
  });

  // BFS
  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const currentDepth = depths.get(currentNodeId)!;

    // Find all outbound gates from this node
    const outboundGates = workflow.gates.filter(
      (g) => g.sourceNodeId === currentNodeId
    );

    for (const gate of outboundGates) {
      if (gate.targetNodeId && !depths.has(gate.targetNodeId)) {
        depths.set(gate.targetNodeId, currentDepth + 1);
        queue.push(gate.targetNodeId);
      }
    }
  }

  return depths;
}

/**
 * Detects loopback routes in a workflow.
 * A route is a loopback if targetDepth < sourceDepth or if it is a self-loop.
 * 
 * Canon Logic:
 * - targetDepth < sourceDepth (Strictly backward)
 * - sourceNodeId === targetNodeId (Explicit self-loop)
 */
export function getWorkflowLoopbacks(workflow: WorkflowLike): LoopbackContext[] {
  const nodeDepths = computeNodeDepths(workflow);
  const loopbacks: LoopbackContext[] = [];

  for (const gate of workflow.gates) {
    if (!gate.targetNodeId) continue;

    const sourceDepth = nodeDepths.get(gate.sourceNodeId);
    const targetDepth = nodeDepths.get(gate.targetNodeId);

    // Explicit self-loop handling
    const isSelfLoop = gate.sourceNodeId === gate.targetNodeId;

    if (isSelfLoop) {
      loopbacks.push({
        sourceNodeId: gate.sourceNodeId,
        targetNodeId: gate.targetNodeId,
        outcomeName: gate.outcomeName,
        topologicalDelta: 0,
      });
      continue;
    }

    // Strictly backward logic: targetDepth < sourceDepth
    if (sourceDepth !== undefined && targetDepth !== undefined) {
      if (targetDepth < sourceDepth) {
        loopbacks.push({
          sourceNodeId: gate.sourceNodeId,
          targetNodeId: gate.targetNodeId,
          outcomeName: gate.outcomeName,
          topologicalDelta: targetDepth - sourceDepth,
        });
      }
    }
  }

  return loopbacks;
}
