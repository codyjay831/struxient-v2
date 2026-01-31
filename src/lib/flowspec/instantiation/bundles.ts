/**
 * Workflow Bundle Registry
 * 
 * Maps packageId (from SaleDetails) to a list of Workflow IDs (templates or slugs)
 * that should be instantiated upon Job provisioning.
 */

export interface WorkflowBundle {
  packageId: string;
  workflowIds: string[]; // These can be IDs or unique names/slugs
}

// Minimal placeholder registry for Phase 3
// In a real system, this might be stored in the database or a config file.
const BUNDLE_REGISTRY: Record<string, string[]> = {
  "standard_install": ["hvac-install-flow", "finance-milestones-flow"],
  "premium_service": ["hvac-install-flow", "extended-warranty-flow", "finance-milestones-flow"],
};

/**
 * Resolves a packageId to a list of Workflow IDs.
 */
export function resolveBundleWorkflows(packageId: string): string[] {
  return BUNDLE_REGISTRY[packageId] || [];
}
