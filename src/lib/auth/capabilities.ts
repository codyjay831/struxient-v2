/**
 * Capability-Based Permission System
 *
 * This module provides a minimal, domain-agnostic capability check for Struxient.
 * It is NOT RBAC. It is a single-purpose system for controlling visibility of
 * sensitive data classes (starting with internal cost data).
 *
 * Enforcement model:
 * - Capabilities are enforced by DATA SHAPING, not UI gating.
 * - If a user lacks a capability, cost fields are omitted/nulled.
 * - Response shapes remain stable.
 * - API does NOT 403 unless the entire surface is cost-only.
 *
 * @module lib/auth/capabilities
 */

import type { MemberRole } from "@prisma/client";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Capability overrides stored on CompanyMember.capabilities
 */
export interface CapabilityOverrides {
  allow: string[];
  deny: string[];
}

/**
 * Authority context required for capability checks.
 * This is the minimum context needed to evaluate permissions.
 */
export interface AuthorityContext {
  role: MemberRole;
  capabilities: CapabilityOverrides;
}

// =============================================================================
// ROLE DEFAULTS
// =============================================================================

/**
 * Role default capabilities.
 *
 * view_cost: Controls visibility of internal cost data.
 *   - OWNER: allow
 *   - ADMIN: allow
 *   - MANAGER: allow
 *   - WORKER: deny
 */
const ROLE_DEFAULTS: Record<MemberRole, Record<string, boolean>> = {
  OWNER: {
    view_cost: true,
  },
  ADMIN: {
    view_cost: true,
  },
  MANAGER: {
    view_cost: true,
  },
  WORKER: {
    view_cost: false,
  },
};

// =============================================================================
// CAPABILITY CHECK
// =============================================================================

/**
 * Check if the authority context has a specific capability.
 *
 * Evaluation order (first match wins):
 * 1. Member deny → false
 * 2. Member allow → true
 * 3. Role default → true/false
 * 4. If no default exists → false (deny by default)
 *
 * @param ctx - Authority context with role and capability overrides
 * @param capability - The capability to check (e.g., "view_cost")
 * @returns true if the user has the capability, false otherwise
 */
export function hasCapability(
  ctx: AuthorityContext,
  capability: string
): boolean {
  // 1. Member deny always wins
  if (ctx.capabilities.deny.includes(capability)) {
    return false;
  }

  // 2. Member allow overrides role default
  if (ctx.capabilities.allow.includes(capability)) {
    return true;
  }

  // 3. Fall back to role default
  const roleDefaults = ROLE_DEFAULTS[ctx.role];
  if (roleDefaults && capability in roleDefaults) {
    return roleDefaults[capability];
  }

  // 4. Deny by default if no rule exists
  return false;
}

// =============================================================================
// COST FIELD OMISSION
// =============================================================================

/**
 * Known cost-class field names.
 * These are the field names that represent internal cost data.
 * Add to this list as new cost fields are introduced.
 *
 * Cost explicitly includes:
 * - cost, costBasis, internalCost, unitCost
 * - margin, markup, profit
 * - internalTotal (company economics totals)
 *
 * Cost explicitly does NOT include:
 * - quantities, specs, scope descriptions
 * - execution requirements
 * - customer-agreed totals required to perform work
 * - anything FlowSpec or task execution depends on
 */
const COST_CLASS_FIELDS = new Set([
  // Cost basis fields
  "cost",
  "costBasis",
  "internalCost",
  "unitCost",
  "internalUnitCost",
  // Margin/markup fields
  "margin",
  "marginPercent",
  "marginAmount",
  "markup",
  "markupPercent",
  "markupAmount",
  // Profit fields
  "profit",
  "profitMargin",
  "grossProfit",
  "netProfit",
  // Internal totals
  "internalTotal",
  "internalSubtotal",
  "costTotal",
]);

/**
 * Omit cost-class fields from data if the user lacks view_cost capability.
 *
 * This function:
 * - Recursively traverses objects and arrays
 * - Sets cost-class fields to null (preserves response shape)
 * - Is safe to call on any data structure
 * - Returns original data unchanged if user has view_cost
 *
 * @param data - Any data structure to filter
 * @param ctx - Authority context for capability check
 * @returns Data with cost fields nulled if user lacks view_cost
 */
export function omitCostFields<T>(data: T, ctx: AuthorityContext): T {
  // If user has view_cost, return data unchanged
  if (hasCapability(ctx, "view_cost")) {
    return data;
  }

  // Apply cost field omission
  return omitCostFieldsRecursive(data);
}

/**
 * Internal recursive implementation for cost field omission.
 * Sets cost-class fields to null while preserving structure.
 */
function omitCostFieldsRecursive<T>(data: T): T {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => omitCostFieldsRecursive(item)) as T;
  }

  // Handle objects
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (COST_CLASS_FIELDS.has(key)) {
        // Null out cost-class fields
        result[key] = null;
      } else if (typeof value === "object" && value !== null) {
        // Recurse into nested objects/arrays
        result[key] = omitCostFieldsRecursive(value);
      } else {
        // Preserve non-cost fields
        result[key] = value;
      }
    }

    return result as T;
  }

  // Primitives pass through unchanged
  return data;
}

// =============================================================================
// UTILITY: Parse capabilities from DB Json field
// =============================================================================

/**
 * Safely parse capabilities from the Json field stored in CompanyMember.
 * Returns empty arrays if parsing fails.
 *
 * @param raw - Raw Json value from database
 * @returns Parsed CapabilityOverrides
 */
export function parseCapabilities(raw: unknown): CapabilityOverrides {
  const defaults: CapabilityOverrides = { allow: [], deny: [] };

  if (typeof raw !== "object" || raw === null) {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;

  return {
    allow: Array.isArray(obj.allow)
      ? obj.allow.filter((x): x is string => typeof x === "string")
      : [],
    deny: Array.isArray(obj.deny)
      ? obj.deny.filter((x): x is string => typeof x === "string")
      : [],
  };
}

/**
 * Build an AuthorityContext from a CompanyMember record.
 *
 * @param member - CompanyMember with role and capabilities fields
 * @returns AuthorityContext ready for capability checks
 */
export function buildAuthorityContext(member: {
  role: MemberRole;
  capabilities: unknown;
}): AuthorityContext {
  return {
    role: member.role,
    capabilities: parseCapabilities(member.capabilities),
  };
}
