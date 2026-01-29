/**
 * FlowSpec Evidence Requirements Enforcement
 *
 * Canon Source: epic_06_flowspec_evidence_system.md §4.2, §8.4
 */

import type { EvidenceAttachment } from "@prisma/client";
import type { SnapshotTask } from "../types";
import { validateEvidenceData } from "./schema";
import type { EvidenceSchema } from "./types";

/**
 * Checks if a task's evidence requirements are satisfied.
 *
 * Canon: 20_flowspec_invariants.md INV-016
 *
 * @param task - The task from workflow snapshot
 * @param attachedEvidence - All evidence attached to this task in the flow
 * @returns { satisfied: boolean; error?: string }
 */
export function checkEvidenceRequirements(
  task: SnapshotTask,
  attachedEvidence: EvidenceAttachment[]
): { satisfied: boolean; error?: string } {
  if (!task.evidenceRequired) {
    return { satisfied: true };
  }

  if (attachedEvidence.length === 0) {
    return {
      satisfied: false,
      error: `Task "${task.name}" requires evidence before an Outcome can be recorded`,
    };
  }

  // Requirement is satisfied if at least one valid evidence exists
  // (unless schema specifies otherwise in future versions)
  const schema = task.evidenceSchema as unknown as EvidenceSchema;
  
  if (!schema) {
    // If required but no schema, just existence is enough
    return { satisfied: true };
  }

  const validEvidence = attachedEvidence.filter((ev) => {
    const result = validateEvidenceData(ev.type, ev.data, schema);
    return result.valid;
  });

  if (validEvidence.length > 0) {
    return { satisfied: true };
  }

  return {
    satisfied: false,
    error: `None of the attached evidence for task "${task.name}" matches the required schema`,
  };
}
