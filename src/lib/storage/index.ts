/**
 * Storage Module Exports
 */

export {
  generateSignedUploadUrl,
  isStorageConfigured,
} from "./s3";

export type {
  SignedUploadResult,
  EvidenceFilePointer,
} from "./s3";
