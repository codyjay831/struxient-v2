/**
 * FlowSpec Evidence Schema Validation
 *
 * Canon Source: epic_06_flowspec_evidence_system.md §4.3, §6.2
 */

import type { EvidenceSchema, EvidenceData, EvidenceStructuredSchema } from "./types";
import { EvidenceType } from "@prisma/client";
import Ajv from "ajv";

const ajv = new Ajv();

const SUPPORTED_KEYWORDS = [
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "description",
  "properties",
  "additionalProperties",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
];

/**
 * Validates that the schema only contains supported keywords.
 * Fail-closed if unsupported keywords are found.
 */
function validateSchemaSafety(schema: any, isPropertiesContext: boolean = false): { safe: boolean; error?: string } {
  if (typeof schema !== "object" || schema === null) return { safe: true };

  if (Array.isArray(schema)) {
    for (const item of schema) {
      const nested = validateSchemaSafety(item);
      if (!nested.safe) return nested;
    }
    return { safe: true };
  }

  const keys = Object.keys(schema);
  for (const key of keys) {
    if (!isPropertiesContext && !SUPPORTED_KEYWORDS.includes(key) && !key.startsWith("$")) {
      return { safe: false, error: `Unsupported JSON Schema keyword: ${key}` };
    }

    if (typeof schema[key] === "object" && schema[key] !== null) {
      const nested = validateSchemaSafety(schema[key], key === "properties");
      if (!nested.safe) return nested;
    }
  }
  return { safe: true };
}

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
  schema: EvidenceStructuredSchema
): { valid: boolean; error?: string } {
  if (!data || typeof data !== "object" || !data.content || typeof data.content !== "object") {
    return { valid: false, error: "Invalid structured evidence data" };
  }

  if (!schema.jsonSchema) {
    // Fail-closed: if it's structured but no schema is provided, we can't validate it safely
    // unless we define a default "any object" policy. Plan required explicit rule.
    // Explicit rule: if schema is missing, allow any object but warn? 
    // Approved plan said: "schema missing? ... Fail-closed."
    return { valid: false, error: "Structured evidence requires a jsonSchema for validation" };
  }

  // Check schema safety
  const safety = validateSchemaSafety(schema.jsonSchema);
  if (!safety.safe) {
    return { valid: false, error: safety.error };
  }

  try {
    const validate = ajv.compile(schema.jsonSchema);
    const valid = validate(data.content);
    if (!valid) {
      const error = validate.errors?.[0];
      return {
        valid: false,
        error: error ? `${error.instancePath} ${error.message}` : "JSON Schema validation failed",
      };
    }
  } catch (err) {
    return { valid: false, error: `JSON Schema compilation error: ${(err as Error).message}` };
  }

  return { valid: true };
}
