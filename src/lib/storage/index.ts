/**
 * Storage Module Exports
 */

export {
  generateSignedUploadUrl,
  generateStorageKey,
  extractCompanyIdFromKey,
  validateStorageKeyOwnership,
  validateFilePointer,
  checkFileExists,
  isStorageConfigured,
} from "./s3";

export type {
  SignedUploadResult,
  EvidenceFilePointer,
} from "./s3";
