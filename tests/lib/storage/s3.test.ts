/**
 * S3 Storage Tests
 *
 * Tests for storage key generation and validation.
 */

import { describe, it, expect } from "vitest";
import {
  generateStorageKey,
  extractCompanyIdFromKey,
  validateStorageKeyOwnership,
  validateFilePointer,
} from "@/lib/storage/s3";

describe("generateStorageKey", () => {
  it("generates key with correct format", () => {
    const key = generateStorageKey("company-123", "flow-456", "task-789", "document.pdf");
    
    expect(key).toMatch(/^company-123\/evidence\/flow-456\/task-789\/\d+-[a-z0-9]+\.pdf$/);
  });

  it("handles files without extension", () => {
    const key = generateStorageKey("company-123", "flow-456", "task-789", "noextension");
    
    expect(key).toMatch(/^company-123\/evidence\/flow-456\/task-789\/\d+-[a-z0-9]+\.bin$/);
  });

  it("generates unique keys for same inputs", () => {
    const key1 = generateStorageKey("company-123", "flow-456", "task-789", "file.txt");
    const key2 = generateStorageKey("company-123", "flow-456", "task-789", "file.txt");
    
    expect(key1).not.toBe(key2);
  });
});

describe("extractCompanyIdFromKey", () => {
  it("extracts companyId from valid key", () => {
    const key = "company-123/evidence/flow-456/task-789/12345-abc.pdf";
    expect(extractCompanyIdFromKey(key)).toBe("company-123");
  });

  it("returns null for invalid key format", () => {
    expect(extractCompanyIdFromKey("invalid")).toBeNull();
    expect(extractCompanyIdFromKey("company-123/files/test.pdf")).toBeNull();
    expect(extractCompanyIdFromKey("")).toBeNull();
  });
});

describe("validateStorageKeyOwnership", () => {
  it("returns true for matching companyId", () => {
    const key = "company-123/evidence/flow-456/task-789/12345-abc.pdf";
    expect(validateStorageKeyOwnership(key, "company-123")).toBe(true);
  });

  it("returns false for mismatched companyId", () => {
    const key = "company-123/evidence/flow-456/task-789/12345-abc.pdf";
    expect(validateStorageKeyOwnership(key, "company-456")).toBe(false);
  });

  it("returns false for invalid key", () => {
    expect(validateStorageKeyOwnership("invalid", "company-123")).toBe(false);
  });
});

describe("validateFilePointer", () => {
  it("validates correct pointer", () => {
    const pointer = {
      storageKey: "company-123/evidence/flow/task/file.pdf",
      fileName: "document.pdf",
      mimeType: "application/pdf",
      size: 1024,
    };
    
    const result = validateFilePointer(pointer);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object data", () => {
    expect(validateFilePointer(null).valid).toBe(false);
    expect(validateFilePointer("string").valid).toBe(false);
    expect(validateFilePointer(123).valid).toBe(false);
  });

  it("rejects missing storageKey", () => {
    const result = validateFilePointer({
      fileName: "test.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("storageKey is required and must be a non-empty string");
  });

  it("rejects missing fileName", () => {
    const result = validateFilePointer({
      storageKey: "key",
      mimeType: "application/pdf",
      size: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("fileName is required and must be a non-empty string");
  });

  it("rejects missing mimeType", () => {
    const result = validateFilePointer({
      storageKey: "key",
      fileName: "test.pdf",
      size: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mimeType is required and must be a non-empty string");
  });

  it("rejects negative size", () => {
    const result = validateFilePointer({
      storageKey: "key",
      fileName: "test.pdf",
      mimeType: "application/pdf",
      size: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("size is required and must be a non-negative number");
  });

  it("allows size of 0", () => {
    const result = validateFilePointer({
      storageKey: "key",
      fileName: "empty.txt",
      mimeType: "text/plain",
      size: 0,
    });
    expect(result.valid).toBe(true);
  });
});
