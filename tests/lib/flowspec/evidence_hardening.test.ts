import { describe, it, expect } from "vitest";
import { validateFilePointer } from "@/lib/flowspec/evidence/schema";

describe("Evidence Pointer Hardening", () => {
  it("should accept a valid FILE pointer", () => {
    const validPointer = {
      storageKey: "company_1/evidence/flow_1/task_1/photo.jpg",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      bucket: "struxient-evidence",
    };
    const result = validateFilePointer(validPointer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject a FILE pointer with unknown keys", () => {
    const invalidPointer = {
      storageKey: "company_1/evidence/flow_1/task_1/photo.jpg",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      bucket: "struxient-evidence",
      extraKey: "dangerous",
    };
    const result = validateFilePointer(invalidPointer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("extraKey");
  });

  it("should reject a FILE pointer with base64 field", () => {
    const invalidPointer = {
      storageKey: "company_1/evidence/flow_1/task_1/photo.jpg",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      bucket: "struxient-evidence",
      base64: "SGVsbG8gV29ybGQ=",
    };
    const result = validateFilePointer(invalidPointer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("base64");
  });

  it("should reject a FILE pointer with missing required fields", () => {
    const invalidPointer = {
      storageKey: "company_1/evidence/flow_1/task_1/photo.jpg",
      // fileName missing
      mimeType: "image/jpeg",
      size: 1024,
      bucket: "struxient-evidence",
    };
    const result = validateFilePointer(invalidPointer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("fileName");
  });

  it("should reject non-object data for FILE pointer", () => {
    const result = validateFilePointer("not an object");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expected object/i);
  });
});
