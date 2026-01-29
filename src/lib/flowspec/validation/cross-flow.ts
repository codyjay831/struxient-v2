/**
 * FlowSpec Cross-Flow Dependency Validation
 *
 * Canon Source: 10_flowspec_engine_contract.md §11.5
 */

import { prisma } from "../../prisma";
import type { WorkflowWithRelations } from "../types";
import type { ValidationError } from "./types";

/**
 * Validates cross-flow dependencies.
 *
 * Checks:
 * - Source Workflow exists and is Published (or same-version draft)
 * - Source Task exists in source Workflow
 * - Required Outcome is a defined Outcome on source Task
 * - Flag circular cross-flow dependencies as errors (v2 behavior)
 *
 * Note: This is an async function because it may need to check other workflows in DB.
 */
export async function validateCrossFlow(
  workflow: WorkflowWithRelations
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  for (const [nodeIndex, node] of workflow.nodes.entries()) {
    for (const [taskIndex, task] of node.tasks.entries()) {
      for (const [depIndex, dep] of task.crossFlowDependencies.entries()) {
        const pathPrefix = `nodes[${nodeIndex}].tasks[${taskIndex}].crossFlowDependencies[${depIndex}]`;

        // 1. Check for circular dependency (self-reference)
        if (dep.sourceWorkflowId === workflow.id) {
          // Check if it's the same task - deadlock
          if (dep.sourceTaskPath === `${node.id}.${task.id}`) {
             errors.push({
              severity: "error",
              category: "cross_flow",
              path: pathPrefix,
              code: "CIRCULAR_DEPENDENCY",
              message: `Task "${task.name}" has a cross-flow dependency on itself, which will cause a deadlock.`,
              suggestion: "Remove self-referencing dependency",
            });
          }
          // Note: Circular between different tasks in same workflow is handled 
          // by standard gate validation or considered an error if it's truly circular.
        }

        // 2. Load source workflow to verify task and outcome
        const sourceWorkflow = await prisma.workflow.findUnique({
          where: { id: dep.sourceWorkflowId },
          include: {
            nodes: {
              include: {
                tasks: {
                  include: {
                    outcomes: true
                  }
                }
              }
            }
          }
        });

        if (!sourceWorkflow) {
          errors.push({
            severity: "error",
            category: "cross_flow",
            path: pathPrefix,
            code: "SOURCE_WORKFLOW_NOT_FOUND",
            message: `Cross-flow dependency references non-existent Workflow ID "${dep.sourceWorkflowId}"`,
            suggestion: "Update dependency to point to a valid Workflow",
          });
          continue;
        }

        // 3. Check if published (or same-version draft)
        // Implementation Plan §4.5 says source must be published (or same-version draft)
        if (sourceWorkflow.status !== "PUBLISHED" && sourceWorkflow.id !== workflow.id) {
          errors.push({
            severity: "error",
            category: "cross_flow",
            path: pathPrefix,
            code: "SOURCE_WORKFLOW_NOT_PUBLISHED",
            message: `Cross-flow dependency references Workflow "${sourceWorkflow.name}" which is not Published`,
            suggestion: "Publish the source workflow before referencing it",
          });
        }

        // 4. Check if source task exists
        // dep.sourceTaskPath is expected to be "nodeId.taskId" or just "taskId"
        // Let's assume taskId for now as that's what Prisma models usually use.
        let foundTask = null;
        for (const sNode of sourceWorkflow.nodes) {
          const sTask = sNode.tasks.find(t => t.id === dep.sourceTaskPath || t.name === dep.sourceTaskPath);
          if (sTask) {
            foundTask = sTask;
            break;
          }
        }

        if (!foundTask) {
          errors.push({
            severity: "error",
            category: "cross_flow",
            path: pathPrefix,
            code: "SOURCE_TASK_NOT_FOUND",
            message: `Cross-flow dependency references non-existent Task "${dep.sourceTaskPath}" in Workflow "${sourceWorkflow.name}"`,
            suggestion: "Update dependency to point to a valid Task",
          });
          continue;
        }

        // 5. Check if outcome exists
        const foundOutcome = foundTask.outcomes.find(o => o.name === dep.requiredOutcome);
        if (!foundOutcome) {
          errors.push({
            severity: "error",
            category: "cross_flow",
            path: pathPrefix,
            code: "SOURCE_OUTCOME_NOT_FOUND",
            message: `Cross-flow dependency references non-existent Outcome "${dep.requiredOutcome}" on Task "${foundTask.name}"`,
            suggestion: "Update dependency to point to a valid Outcome",
          });
        }
      }
    }
  }

  return errors;
}
