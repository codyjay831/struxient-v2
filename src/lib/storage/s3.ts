/**
 * S3-Compatible Storage Client
 *
 * Provides pre-signed URL generation for evidence file uploads.
 * Supports AWS S3, Cloudflare R2, MinIO, and other S3-compatible services.
 *
 * Key Design:
 * - All uploads are tenant-scoped (companyId prefix in key)
 * - Pre-signed URLs expire after a configurable time
 * - No binary data is stored in the database (pointer only)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// =============================================================================
// CONFIGURATION
// =============================================================================

const getS3Config = () => {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.");
  }

  return {
    endpoint,
    region,
    bucket,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  };
};

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    const config = getS3Config();
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: config.credentials,
      forcePathStyle: config.forcePathStyle,
    });
  }
  return s3Client;
};

// =============================================================================
// TYPES
// =============================================================================

export interface SignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
  bucket: string;
}

export interface EvidenceFilePointer {
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  bucket: string;
}

// =============================================================================
// KEY GENERATION
// =============================================================================

/**
 * Generate a tenant-scoped storage key for evidence files.
 * Format: {companyId}/evidence/{flowId}/{taskId}/{timestamp}-{random}.{ext}
 */
export function generateStorageKey(
  companyId: string,
  flowId: string,
  taskId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  
  return `${companyId}/evidence/${flowId}/${taskId}/${timestamp}-${random}.${ext}`;
}

/**
 * Extract companyId from storage key.
 * Returns null if key format is invalid.
 */
export function extractCompanyIdFromKey(storageKey: string): string | null {
  const parts = storageKey.split("/");
  if (parts.length < 2 || parts[1] !== "evidence") {
    return null;
  }
  return parts[0];
}

// =============================================================================
// SIGNED URL GENERATION
// =============================================================================

/**
 * Generate a pre-signed upload URL for evidence file.
 * URL expires after the specified duration.
 *
 * @param companyId - Tenant ID for key scoping
 * @param flowId - Flow ID for organization
 * @param taskId - Task ID for organization
 * @param fileName - Original file name
 * @param mimeType - MIME type of the file
 * @param expiresInSeconds - URL expiration time (default: 15 minutes)
 */
export async function generateSignedUploadUrl(
  companyId: string,
  flowId: string,
  taskId: string,
  fileName: string,
  mimeType: string,
  expiresInSeconds: number = 900
): Promise<SignedUploadResult> {
  const config = getS3Config();
  const client = getS3Client();
  
  const storageKey = generateStorageKey(companyId, flowId, taskId, fileName);
  
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    uploadUrl,
    storageKey,
    expiresAt,
    bucket: config.bucket,
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a storage key belongs to the specified company.
 * Prevents cross-tenant evidence access.
 */
export function validateStorageKeyOwnership(storageKey: string, companyId: string): boolean {
  const keyCompanyId = extractCompanyIdFromKey(storageKey);
  return keyCompanyId === companyId;
}

/**
 * Validate evidence file pointer structure.
 * Returns errors if the pointer is malformed.
 */
export function validateFilePointer(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["FILE evidence data must be an object"] };
  }

  const pointer = data as Record<string, unknown>;

  if (typeof pointer.storageKey !== "string" || !pointer.storageKey) {
    errors.push("storageKey is required and must be a non-empty string");
  }

  if (typeof pointer.fileName !== "string" || !pointer.fileName) {
    errors.push("fileName is required and must be a non-empty string");
  }

  if (typeof pointer.mimeType !== "string" || !pointer.mimeType) {
    errors.push("mimeType is required and must be a non-empty string");
  }

  if (typeof pointer.size !== "number" || pointer.size < 0) {
    errors.push("size is required and must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a file exists in S3 storage.
 * Used to validate pointer before attaching evidence.
 */
export async function checkFileExists(storageKey: string): Promise<boolean> {
  try {
    const config = getS3Config();
    const client = getS3Client();
    
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // Re-throw other errors (permission issues, network, etc.)
    throw error;
  }
}

// =============================================================================
// CONFIGURATION CHECK
// =============================================================================

/**
 * Check if S3 storage is configured.
 */
export function isStorageConfigured(): boolean {
  try {
    getS3Config();
    return true;
  } catch {
    return false;
  }
}
