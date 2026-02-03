import { describe, it, expect } from "vitest";
import { checkEvidenceRequirements } from "@/lib/flowspec/evidence";
import type { SnapshotTask } from "@/lib/flowspec/types";
import type { EvidenceAttachment } from "@prisma/client";

describe("Deterministic Diagnostics (Slice C Enrichment)", () => {
  const mockTask: SnapshotTask = {
    id: "task1",
    name: "Evidence Task",
    instructions: null,
    evidenceRequired: true,
    evidenceSchema: { type: "structured", jsonSchema: { type: "object", required: ["verified"] } },
    displayOrder: 1,
    outcomes: [{ id: "o1", name: "DONE" }]
  };

  it("should return satisfied: false when required evidence is missing", () => {
    const evidence: EvidenceAttachment[] = [];
    const result = checkEvidenceRequirements(mockTask, evidence);
    expect(result.satisfied).toBe(false);
    expect(result.error).toContain("requires evidence");
  });

  it("should return satisfied: false when evidence does not match schema", () => {
    const evidence: EvidenceAttachment[] = [
      {
        id: "ev1",
        flowId: "flow1",
        taskId: "task1",
        type: "STRUCTURED",
        data: { wrong: "field" },
        attachedAt: new Date(),
        attachedBy: "user1",
        taskExecutionId: null,
        idempotencyKey: null
      } as EvidenceAttachment
    ];
    const result = checkEvidenceRequirements(mockTask, evidence);
    expect(result.satisfied).toBe(false);
    expect(result.error).toContain("matches the required schema");
  });

  it("should return satisfied: true when evidence matches schema", () => {
    const evidence: EvidenceAttachment[] = [
      {
        id: "ev1",
        flowId: "flow1",
        taskId: "task1",
        type: "STRUCTURED",
        data: { content: { verified: true } },
        attachedAt: new Date(),
        attachedBy: "user1",
        taskExecutionId: null,
        idempotencyKey: null
      } as EvidenceAttachment
    ];
    const result = checkEvidenceRequirements(mockTask, evidence);
    expect(result.satisfied).toBe(true);
  });

  it("should return satisfied: true when evidence is not required", () => {
    const optionalTask: SnapshotTask = { ...mockTask, evidenceRequired: false };
    const evidence: EvidenceAttachment[] = [];
    const result = checkEvidenceRequirements(optionalTask, evidence);
    expect(result.satisfied).toBe(true);
  });
});
