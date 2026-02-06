/**
 * Template Import Service
 *
 * Handles importing workflow templates into tenant workspaces.
 * Templates are non-executing sources; importing creates a tenant-owned DRAFT.
 */

import { prisma } from "@/lib/prisma";
import { parseTemplateDefinition } from "./schema";
import { hydrateSnapshotToWorkflow } from "../persistence/workflow";
import type { WorkflowSnapshot } from "../types";
import type { TenantContext } from "@/lib/auth/tenant";

// =============================================================================
// TYPES
// =============================================================================

export interface ImportResult {
  success: boolean;
  workflowId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface TemplateListItem {
  id: string;
  tradeKey: string;
  category: string;
  name: string;
  description: string | null;
  version: number;
  tags: string[];
}

// =============================================================================
// TEMPLATE QUERIES
// =============================================================================

/**
 * List all available templates, optionally filtered by trade.
 * By default, excludes fixtures/demo templates.
 */
export async function listTemplates(
  tradeKey?: string,
  includeFixtures: boolean = false
): Promise<TemplateListItem[]> {
  // Security Guard: Only allow fixtures in development or when explicitly requested in dev
  const shouldIncludeFixtures = includeFixtures && process.env.NODE_ENV === "development";

  const templates = await prisma.workflowTemplate.findMany({
    where: {
      AND: [
        tradeKey ? { tradeKey } : {},
        { isFixture: shouldIncludeFixtures ? undefined : false },
      ],
    },
    select: {
      id: true,
      tradeKey: true,
      category: true,
      name: true,
      description: true,
      version: true,
      tags: true,
    },
    orderBy: [{ tradeKey: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  return templates;
}

/**
 * Get a specific template by ID.
 */
export async function getTemplate(templateId: string) {
  return prisma.workflowTemplate.findUnique({
    where: { id: templateId },
  });
}

/**
 * Get distinct trade keys for filtering.
 */
export async function getTradeKeys(): Promise<string[]> {
  const trades = await prisma.workflowTemplate.findMany({
    select: { tradeKey: true },
    distinct: ["tradeKey"],
    orderBy: { tradeKey: "asc" },
  });

  return trades.map((t) => t.tradeKey);
}

// =============================================================================
// TEMPLATE IMPORT
// =============================================================================

/**
 * Import a template into a tenant's workspace.
 *
 * Process:
 * 1. Fetch the template
 * 2. Validate the template definition (Zod + structural checks)
 * 3. Check for name conflicts in tenant workspace
 * 4. Hydrate snapshot into DB rows with provenance
 *
 * @param templateId - The template to import
 * @param tenantCtx - Tenant context from getActorTenantContext()
 * @param userId - The user performing the import
 * @returns ImportResult with new workflow ID or error
 */
export async function importTemplate(
  templateId: string,
  tenantCtx: TenantContext,
  userId: string
): Promise<ImportResult> {
  // 1. Fetch the template
  const template = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    return {
      success: false,
      error: { code: "TEMPLATE_NOT_FOUND", message: "Template not found" },
    };
  }

  // 2. Validate the template definition (fail-closed)
  let snapshot: WorkflowSnapshot;
  try {
    snapshot = parseTemplateDefinition(template.definition) as WorkflowSnapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid template definition";
    return {
      success: false,
      error: { code: "INVALID_TEMPLATE", message },
    };
  }

  // 3. Check for name conflicts in tenant workspace
  const existingWorkflow = await prisma.workflow.findFirst({
    where: {
      companyId: tenantCtx.companyId,
      name: template.name,
    },
  });

  // Determine version number
  let version = 1;
  if (existingWorkflow) {
    // Find the latest version with this name
    const latestVersion = await prisma.workflow.findFirst({
      where: { companyId: tenantCtx.companyId, name: template.name },
      orderBy: { version: "desc" },
    });
    version = (latestVersion?.version ?? 0) + 1;
  }

  // 4. Hydrate snapshot into DB rows with provenance
  try {
    const result = await prisma.$transaction(async (tx) => {
      return hydrateSnapshotToWorkflow(tx, snapshot, {
        companyId: tenantCtx.companyId,
        version,
        provenance: {
          templateId: template.id,
          templateVersion: template.version,
          importedBy: userId,
        },
      });
    });

    return {
      success: true,
      workflowId: result.workflowId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import template";
    return {
      success: false,
      error: { code: "IMPORT_FAILED", message },
    };
  }
}
