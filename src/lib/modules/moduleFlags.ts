/**
 * Module enablement flags.
 * 
 * Future: This will be driven by DB/tenant settings or integrations.
 * For now: Use env flags or defaults.
 * 
 * Corner-safety: Do NOT assume any module is permanent.
 * Do NOT couple workflows to module presence.
 */

export type ModuleKey =
  | "workstation"
  | "flowspec"
  | "jobs"
  | "customers"
  | "sales"
  | "finance"
  | "admin"
  | "settings";

// Default module states - core modules always enabled
const DEFAULT_FLAGS: Record<ModuleKey, boolean> = {
  workstation: true,
  flowspec: true,
  jobs: true,
  customers: true,
  sales: true,
  finance: true,
  admin: true,
  settings: true,
};

/**
 * Get module enablement flags.
 * 
 * Priority:
 * 1. Environment variable override (NEXT_PUBLIC_ENABLE_<MODULE>)
 * 2. Default value
 * 
 * Future: Will check DB/tenant settings.
 */
export function getModuleFlags(): Record<ModuleKey, boolean> {
  // Check env overrides for optional modules
  const salesEnabled = process.env.NEXT_PUBLIC_ENABLE_SALES;
  const financeEnabled = process.env.NEXT_PUBLIC_ENABLE_FINANCE;

  return {
    ...DEFAULT_FLAGS,
    // Only override if explicitly set to "false"
    sales: salesEnabled === "false" ? false : DEFAULT_FLAGS.sales,
    finance: financeEnabled === "false" ? false : DEFAULT_FLAGS.finance,
  };
}

/**
 * Check if a specific module is enabled.
 */
export function isModuleEnabled(moduleKey: ModuleKey): boolean {
  return getModuleFlags()[moduleKey];
}

/**
 * Get list of enabled modules.
 */
export function getEnabledModules(): ModuleKey[] {
  const flags = getModuleFlags();
  return (Object.keys(flags) as ModuleKey[]).filter((key) => flags[key]);
}
