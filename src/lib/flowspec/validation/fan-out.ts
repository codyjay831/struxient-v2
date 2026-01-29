/**
 * FlowSpec Fan-out Validation
 *
 * Canon Source: 10_flowspec_engine_contract.md §10.3
 */

import { prisma } from "../../prisma";
import type { WorkflowWithRelations } from "../types";
import type { ValidationError } from "./types";

/**
 * Validates fan-out rules.
 *
 * Checks:
 * - Target Workflow exists and is Published
 * - Trigger Outcome is a valid outcome name in source Node
 * - Flag unbounded fan-out patterns as errors (v2)
 */
export async function validateFanOut(
  workflow: WorkflowWithRelations
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  for (const [ruleIndex, rule] of workflow.fanOutRules.entries()) {
    const pathPrefix = `fanOutRules[${ruleIndex}]`;

    // 1. Check if trigger outcome is valid in source node
    const sourceNode = workflow.nodes.find(n => n.id === rule.sourceNodeId);
    if (!sourceNode) {
      errors.push({
        severity: "error",
        category: "fan_out",
        path: pathPrefix,
        code: "INVALID_FANOUT_SOURCE",
        message: `Fan-out rule references non-existent source Node ID "${rule.sourceNodeId}"`,
        suggestion: "Update rule to point to a valid Node in this workflow",
      });
    } else {
      const allOutcomes = new Set<string>();
      sourceNode.tasks.forEach(t => t.outcomes.forEach(o => allOutcomes.add(o.name)));
      
      if (!allOutcomes.has(rule.triggerOutcome)) {
        errors.push({
          severity: "error",
          category: "fan_out",
          path: pathPrefix,
          code: "INVALID_FANOUT_OUTCOME",
          message: `Fan-out rule trigger outcome "${rule.triggerOutcome}" is not defined in any task within Node "${sourceNode.name}"`,
          suggestion: "Use an outcome that exists in the source node",
        });
      }
    }

    // 2. Load target workflow
    const targetWorkflow = await prisma.workflow.findUnique({
      where: { id: rule.targetWorkflowId }
    });

    if (!targetWorkflow) {
      errors.push({
        severity: "error",
        category: "fan_out",
        path: pathPrefix,
        code: "TARGET_WORKFLOW_NOT_FOUND",
        message: `Fan-out rule references non-existent target Workflow ID "${rule.targetWorkflowId}"`,
        suggestion: "Update rule to point to a valid target Workflow",
      });
    } else if (targetWorkflow.status !== "PUBLISHED") {
      // 3. Target must be published
      errors.push({
        severity: "error",
        category: "fan_out",
        path: pathPrefix,
        code: "TARGET_WORKFLOW_NOT_PUBLISHED",
        message: `Fan-out rule targets Workflow "${targetWorkflow.name}" which is not Published`,
        suggestion: "Publish the target workflow before referencing it in a fan-out rule",
      });
    }

    // 4. Recursive fan-out check (Self-triggering)
    if (rule.targetWorkflowId === workflow.id) {
      errors.push({
        severity: "error",
        category: "fan_out",
        path: pathPrefix,
        code: "RECURSIVE_FANOUT",
        message: `Workflow "${workflow.name}" cannot fan-out to itself, as this would cause infinite recursion.`,
        suggestion: "Remove self-triggering fan-out rule",
      });
    }
  }

  return errors;
}
