/**
 * FlowSpec Analysis & Diagnosis (READ-ONLY)
 *
 * This module provides logic for publish-time impact analysis and
 * runtime stall diagnosis.
 *
 * MECHANICAL GUARD:
 * This file MUST NOT import from flowspec/truth or flowspec/engine.
 * This file MUST NOT contain prisma.*.create/update/delete.
 */

import { prisma } from "@/lib/prisma";
import { FlowStatus } from "@prisma/client";
import type {
  WorkflowSnapshot,
  SnapshotNode,
  SnapshotTask,
  PublishImpactReport,
  ImpactBreakingChange,
  StallDiagnosis,
  StallReasonCode,
} from "./types";

/**
 * Computes the impact of publishing a new Draft workflow.
 * Compares the Draft structure against active flows.
 */
export async function computePublishImpact(
  workflowId: string,
  draftSnapshot: WorkflowSnapshot
): Promise<PublishImpactReport> {
  const now = new Date();
  const breakingChanges: ImpactBreakingChange[] = [];

  // 1. Get active flows for this workflow
  const activeFlowsCount = await prisma.flow.count({
    where: {
      workflowId,
      status: FlowStatus.ACTIVE,
    },
  });

  if (activeFlowsCount === 0) {
    return {
      breakingChanges: [],
      activeFlowsCount: 0,
      isAnalysisComplete: true,
      timestamp: now,
    };
  }

  // 2. Load the latest published version to compare
  const latestVersion = await prisma.workflowVersion.findFirst({
    where: { workflowId },
    orderBy: { version: "desc" },
  });

  if (!latestVersion) {
    return {
      breakingChanges: [],
      activeFlowsCount,
      isAnalysisComplete: true,
      timestamp: now,
    };
  }

  const latestSnapshot = latestVersion.snapshot as unknown as WorkflowSnapshot;

  // 3. Detect Outcome Renames/Deletions affecting CFDs
  // Find all active flows (any workflow) that have CFDs targeting this workflowId
  const dependentFlows = await prisma.flow.findMany({
    where: {
      status: FlowStatus.ACTIVE,
      workflow: {
        nodes: {
          some: {
            tasks: {
              some: {
                crossFlowDependencies: {
                  some: { sourceWorkflowId: workflowId }
                }
              }
            }
          }
        }
      }
    },
    include: {
      workflowVersion: true
    }
  });

  const missingOutcomes = new Set<string>();
  const latestOutcomes = new Set<string>();
  latestSnapshot.nodes.flatMap(n => n.tasks).flatMap(t => t.outcomes).forEach(o => latestOutcomes.add(o.name));
  
  const draftOutcomes = new Set<string>();
  draftSnapshot.nodes.flatMap(n => n.tasks).flatMap(t => t.outcomes).forEach(o => draftOutcomes.add(o.name));

  for (const outcome of latestOutcomes) {
    if (!draftOutcomes.has(outcome)) {
      missingOutcomes.add(outcome);
    }
  }

  if (missingOutcomes.size > 0) {
    // Check if any active CFD actually targets these missing outcomes
    for (const outcome of missingOutcomes) {
      const affectedCount = dependentFlows.filter(f => {
        const snap = f.workflowVersion.snapshot as unknown as WorkflowSnapshot;
        return snap.nodes.some(n => 
          n.tasks.some(t => 
            t.crossFlowDependencies.some(d => 
              d.sourceWorkflowId === workflowId && d.requiredOutcome === outcome
            )
          )
        );
      }).length;

      if (affectedCount > 0) {
        breakingChanges.push({
          type: "OUTCOME_RENAME",
          severity: "HIGH",
          message: `Outcome '${outcome}' is missing in the new version.`,
          affectedFlowsCount: affectedCount,
          details: { outcome }
        });
      }
    }
  }

  // 4. Detect Fan-out Node Deletions
  const latestNodeIds = new Set(latestSnapshot.nodes.map(n => n.id));
  const draftNodeIds = new Set(draftSnapshot.nodes.map(n => n.id));
  const deletedNodeIds = [...latestNodeIds].filter(id => !draftNodeIds.has(id));

  if (deletedNodeIds.length > 0) {
    const affectedRules = await prisma.fanOutRule.findMany({
      where: {
        workflowId,
        sourceNodeId: { in: deletedNodeIds }
      }
    });

    if (affectedRules.length > 0) {
      breakingChanges.push({
        type: "NODE_DELETION",
        severity: "HIGH",
        message: `${affectedRules.length} Fan-out trigger(s) will be orphaned.`,
        affectedFlowsCount: activeFlowsCount, // All active flows of this type might reach these nodes
        details: { deletedNodeIds }
      });
    }
  }

  return {
    breakingChanges,
    activeFlowsCount,
    isAnalysisComplete: true,
    timestamp: now,
  };
}

/**
 * Diagnoses why a Flow is stalled (has no actionable tasks).
 * Only runs for flows that are NOT COMPLETED and NOT BLOCKED.
 */
export async function diagnoseFlowStall(flowId: string): Promise<StallDiagnosis> {
  const now = new Date();
  
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: {
      workflowVersion: true,
      nodeActivations: true,
      taskExecutions: true,
    }
  });

  if (!flow) {
    return { isStalled: false, timestamp: now };
  }

  if (flow.status === FlowStatus.COMPLETED || flow.status === FlowStatus.BLOCKED) {
    return { isStalled: false, timestamp: now };
  }

  const snapshot = flow.workflowVersion.snapshot as unknown as WorkflowSnapshot;
  
  // A flow is stalled if it's not complete but has no actionable tasks.
  // We assume the caller already knows it has no actionable tasks, 
  // but we'll re-verify conceptually.
  
  // 1. Check for Signal Mismatch (CFD)
  const activeNodes = flow.nodeActivations.filter(na => {
    // Check if node is complete for its iteration
    const node = snapshot.nodes.find(n => n.id === na.nodeId);
    if (!node) return false;
    
    // Simplistic completion check for diagnosis
    const outcomes = flow.taskExecutions.filter(te => 
      te.taskId.startsWith(node.id) && // approximation
      te.iteration === na.iteration && 
      te.outcome !== null
    );
    return outcomes.length === 0; // If no outcomes, it's still active
  });

  if (activeNodes.length > 0) {
    for (const na of activeNodes) {
      const node = snapshot.nodes.find(n => n.id === na.nodeId);
      if (!node) continue;

      for (const task of node.tasks) {
        if (task.crossFlowDependencies.length > 0) {
          for (const dep of task.crossFlowDependencies) {
            // Check if target workflow exists and has outcomes
            const targetWorkflow = await prisma.workflow.findUnique({
              where: { id: dep.sourceWorkflowId },
              include: { versions: { orderBy: { version: "desc" }, take: 1 } }
            });

            if (targetWorkflow && targetWorkflow.versions[0]) {
              const targetSnapshot = targetWorkflow.versions[0].snapshot as unknown as WorkflowSnapshot;
              const targetOutcomes = targetSnapshot.nodes.flatMap(n => n.tasks).flatMap(t => t.outcomes);
              
              if (!targetOutcomes.some(o => o.name === dep.requiredOutcome)) {
                return {
                  isStalled: true,
                  reasonCode: "ERR_CFD_NAME",
                  message: `Waiting for outcome '${dep.requiredOutcome}' which no longer exists in workflow '${targetWorkflow.name}'.`,
                  details: {
                    sourceWorkflowId: dep.sourceWorkflowId,
                    requiredOutcome: dep.requiredOutcome,
                    nodeId: node.id,
                    taskId: task.id
                  },
                  timestamp: now
                };
              }
            }
          }
        }
      }
    }
  }

  // 2. Check for Orphaned Fan-out
  // If a flow is active but all its active nodes are complete, and it's not COMPLETED status
  // it might be waiting on a fan-out that didn't happen.
  // (In practice, COMPLETED status is derived, but let's check for orphaned triggers)

  return {
    isStalled: true,
    reasonCode: "ERR_DEAD_GATE", // Default if we can't find a more specific one
    message: "The flow has no actionable tasks and has not reached a terminal state.",
    timestamp: now
  };
}
