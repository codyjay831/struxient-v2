/**
 * Vault Storage Status API
 * 
 * Returns configuration status for preflight checks.
 * Located under /api/tenancy/vault to align with company-wide evidence storage patterns.
 */

import { getActorTenantContext, tenantErrorResponse } from "@/lib/auth/tenant";
import { apiSuccess } from "@/lib/api-utils";
import { isStorageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Returns whether storage is configured for the current tenant's context.
 * GET /api/tenancy/vault/status
 */
export async function GET() {
  try {
    const { authority } = await getActorTenantContext();
    
    // SECURITY: Only return the boolean status. 
    // Do NOT leak S3_ENDPOINT, S3_BUCKET, or credentials.
    return apiSuccess({
      isConfigured: isStorageConfigured(),
    }, 200, authority);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
