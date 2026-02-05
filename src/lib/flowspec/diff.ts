/**
 * Semantic Diff Utility for Workflow Snapshots
 * 
 * Computes meaningful human-readable changes between two workflow snapshots.
 * Focuses on semantic changes (nodes, tasks, outcomes, gates).
 */

export interface SemanticChange {
  kind: "NODE_ADDED" | "NODE_REMOVED" | "NODE_RENAMED" | "NODE_KIND_CHANGED" | "TASK_ADDED" | "TASK_REMOVED" | "TASK_CHANGED" | "GATE_CHANGED" | "GATE_ADDED" | "GATE_REMOVED";
  nodeId?: string;
  taskId?: string;
  label: string;
  details?: string;
}

export function computeSemanticDiff(base: any, current: any): SemanticChange[] {
  const changes: SemanticChange[] = [];

  if (!base || !current) return [];

  // 1. Node Changes
  const baseNodes: any[] = base.nodes || [];
  const currentNodes: any[] = current.nodes || [];
  const baseNodeMap = new Map(baseNodes.map((n: any) => [n.id, n]));
  const currentNodeMap = new Map(currentNodes.map((n: any) => [n.id, n]));

  // Added Nodes
  currentNodes.forEach((node: any) => {
    if (!baseNodeMap.has(node.id)) {
      changes.push({ kind: "NODE_ADDED", nodeId: node.id, label: `Added node "${node.name}"` });
    } else {
      const baseNode: any = baseNodeMap.get(node.id);
      if (baseNode.name !== node.name) {
        changes.push({ kind: "NODE_RENAMED", nodeId: node.id, label: `Renamed "${baseNode.name}" to "${node.name}"` });
      }
      if (baseNode.nodeKind !== node.nodeKind) {
        changes.push({ kind: "NODE_KIND_CHANGED", nodeId: node.id, label: `Changed "${node.name}" to ${node.nodeKind}` });
      }

      // 2. Task Changes within Node
      const baseTasks: any[] = baseNode.tasks || [];
      const currentTasks: any[] = node.tasks || [];
      const baseTaskMap = new Map(baseTasks.map((t: any) => [t.id, t]));
      
      currentTasks.forEach((task: any) => {
        if (!baseTaskMap.has(task.id)) {
          changes.push({ kind: "TASK_ADDED", nodeId: node.id, taskId: task.id, label: `Added task "${task.name}" to "${node.name}"` });
        } else {
          const baseTask: any = baseTaskMap.get(task.id);
          if (baseTask.name !== task.name || baseTask.instructions !== task.instructions || baseTask.evidenceRequired !== task.evidenceRequired) {
            changes.push({ kind: "TASK_CHANGED", nodeId: node.id, taskId: task.id, label: `Updated task "${task.name}" in "${node.name}"` });
          }
        }
      });

      baseTasks.forEach((task: any) => {
        if (!currentNodeMap.has(node.id) || !node.tasks.some((t: any) => t.id === task.id)) {
          changes.push({ kind: "TASK_REMOVED", nodeId: node.id, taskId: task.id, label: `Removed task "${task.name}" from "${node.name}"` });
        }
      });
    }
  });

  // Removed Nodes
  baseNodes.forEach((node: any) => {
    if (!currentNodeMap.has(node.id)) {
      changes.push({ kind: "NODE_REMOVED", nodeId: node.id, label: `Removed node "${node.name}"` });
    }
  });

  // 3. Gate Changes
  const baseGates: any[] = base.gates || [];
  const currentGates: any[] = current.gates || [];
  const baseGateMap = new Map(baseGates.map((g: any) => [`${g.sourceNodeId}:${g.outcomeName}`, g]));
  const currentGateMap = new Map(currentGates.map((g: any) => [`${g.sourceNodeId}:${g.outcomeName}`, g]));

  currentGates.forEach((gate: any) => {
    const key = `${gate.sourceNodeId}:${gate.outcomeName}`;
    if (!baseGateMap.has(key)) {
      changes.push({ kind: "GATE_ADDED", label: `Added routing for "${gate.outcomeName}"` });
    } else {
      const baseGate: any = baseGateMap.get(key);
      if (baseGate.targetNodeId !== gate.targetNodeId) {
        changes.push({ kind: "GATE_CHANGED", label: `Changed target for "${gate.outcomeName}"` });
      }
    }
  });

  baseGates.forEach((gate: any) => {
    const key = `${gate.sourceNodeId}:${gate.outcomeName}`;
    if (!currentGateMap.has(key)) {
      changes.push({ kind: "GATE_REMOVED", label: `Removed routing for "${gate.outcomeName}"` });
    }
  });

  return changes;
}
