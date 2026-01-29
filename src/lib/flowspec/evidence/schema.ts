/**
 * FlowSpec Evidence Schema Validation
 *
 * Canon Source: epic_06_flowspec_evidence_system.md §4.3, §6.2
 */

import type { EvidenceSchema, EvidenceData } from "./types";
import { EvidenceType } from "@prisma/client";

/**
 * Validates evidence data against a schema.
 *
 * @param type - The EvidenceType (FILE, TEXT, STRUCTURED)
 * @param data - The evidence data
 * @param schema - The EvidenceSchema from workflow specification
 * @returns { valid: boolean; error?: string }
 */
export function validateEvidenceData(
  type: EvidenceType,
  data: any,
  schema: EvidenceSchema
): { valid: boolean; error?: string } {
  // 1. Check if type matches schema type
  if (type.toLowerCase() !== schema.type) {
    return {
      valid: false,
      error: `Evidence type mismatch: expected ${schema.type}, got ${type.toLowerCase()}`,
    };
  }

  switch (schema.type) {
    case "file":
      return validateFileEvidence(data, schema);
    case "text":
      return validateTextEvidence(data, schema);
    case "structured":
      return validateStructuredEvidence(data, schema);
    default:
      return { valid: true };
  }
}

function validateFileEvidence(
  data: any,
  schema: any // EvidenceFileSchema
): { valid: boolean; error?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid file evidence data" };
  }

  // mimeTypes check
  if (schema.mimeTypes && schema.mimeTypes.length > 0) {
    if (!schema.mimeTypes.includes(data.mimeType)) {
      return {
        valid: false,
        error: `File type ${data.mimeType} not allowed. Allowed: ${schema.mimeTypes.join(", ")}`,
      };
    }
  }

  // maxSize check
  if (schema.maxSize && data.size > schema.maxSize) {
    return {
      valid: false,
      error: `File size ${data.size} exceeds maximum of ${schema.maxSize} bytes`,
    };
  }

  return { valid: true };
}

function validateTextEvidence(
  data: any,
  schema: any // EvidenceTextSchema
): { valid: boolean; error?: string } {
  if (!data || typeof data !== "object" || typeof data.content !== "string") {
    return { valid: false, error: "Invalid text evidence data" };
  }

  const content = data.content;

  if (schema.minLength && content.length < schema.minLength) {
    return {
      valid: false,
      error: `Text length ${content.length} is less than minimum of ${schema.minLength}`,
    };
  }

  if (schema.maxLength && content.length > schema.maxLength) {
    return {
      valid: false,
      error: `Text length ${content.length} exceeds maximum of ${schema.maxLength}`,
    };
  }

  return { valid: true };
}

function validateStructuredEvidence(
  data: any,
  schema: any // EvidenceStructuredSchema
): { valid: boolean; error?: string } {
  if (!data || typeof data !== "object" || !data.content || typeof data.content !== "object") {
    return { valid: false, error: "Invalid structured evidence data" };
  }

  // Basic validation - in v2 we might use a full JSON schema validator like Ajv
  // For now, we just check if it exists if required.
  
  return { valid: true };
}
