/**
 * FlowSpec Evidence Schema Types
 *
 * Canon Source: 10_flowspec_engine_contract.md §8.3, epic_06_flowspec_evidence_system.md §8.1
 */

export type EvidenceSchemaType = "file" | "text" | "structured";

export interface EvidenceFileSchema {
  type: "file";
  mimeTypes?: string[];
  maxSize?: number; // in bytes
  description?: string;
}

export interface EvidenceTextSchema {
  type: "text";
  minLength?: number;
  maxLength?: number;
  description?: string;
}

export interface EvidenceStructuredSchema {
  type: "structured";
  jsonSchema?: Record<string, unknown>;
  description?: string;
}

export type EvidenceSchema =
  | EvidenceFileSchema
  | EvidenceTextSchema
  | EvidenceStructuredSchema;

export interface EvidenceFileData {
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  bucket: string;
}

export interface EvidenceTextData {
  content: string;
}

export interface EvidenceStructuredData {
  content: Record<string, unknown>;
}

export type EvidenceData =
  | EvidenceFileData
  | EvidenceTextData
  | EvidenceStructuredData;
