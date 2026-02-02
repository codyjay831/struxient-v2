/**
 * FlowSpec Workflow Persistence Gateway
 *
 * This module is the ONLY location allowed to perform prisma.workflow.*
 * operations within FlowSpec code paths. All workflow writes must route
 * through these functions.
 *
 * Enforcement: CI guard (guard_flowspec_persistence_boundary.mjs) scans
 * src/app/api/flowspec/** and src/lib/flowspec/** for raw prisma.workflow
 * calls outside this file.
 *
 * Gateway Methods:
 * - createWorkflow: Standard creation (no provenance)
 * - createWorkflowFromTemplate: Import with provenance (write-once)
 * - updateWorkflow: Updates (provenance excluded from allowed fields)
 * - deleteWorkflow: Delete with tenant verification
 */

import { prisma } from "@/lib/prisma";
import { WorkflowStatus, Prisma } from "@prisma/client";
import type { TenantContext } from "@/lib/auth/tenant";
import type { WorkflowSnapshot } from "../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of hydration operation.
 */
export interface HydrationResult {
  workflowId: string;
  nodeIdMap: Map<string, string>;
  taskIdMap: Map<string, string>;
}

/**
 * Options for hydration.
 */
export interface HydrationOptions {
  /** Company ID for tenant ownership */
  companyId: string;
  /** Version number for the new workflow */
  version: number;
  /** Optional: Template provenance (only for template import) */
  provenance?: {
    templateId: string;
    templateVersion: number;
    importedBy: string;
  };
}

/**
 * Data for creating a new workflow (standard creation).
 * Provenance fields are NOT allowed here.
 */
export interface CreateWorkflowData {
  companyId: string;
  name: string;
  description?: string | null;
  isNonTerminating?: boolean;
  version?: number;
}

/**
 * Template provenance for imported workflows.
 * These fields are immutable after import.
 */
export interface TemplateProvenance {
  templateId: string;
  templateVersion: number;
  importedBy: string;
}

/**
 * Data for updating a workflow.
 * Provenance fields are EXCLUDED - cannot be updated.
 */
export interface UpdateWorkflowData {
  name?: string;
  description?: string | null;
  isNonTerminating?: boolean;
  status?: WorkflowStatus;
  publishedAt?: Date | null;
}

// =============================================================================
// GATEWAY METHODS
// =============================================================================

/**
 * Create a new workflow (standard creation, no template provenance).
 *
 * @param data - Workflow creation data
 * @returns Created workflow
 */
export async function createWorkflow(data: CreateWorkflowData) {
  return prisma.workflow.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      description: data.description ?? null,
      isNonTerminating: data.isNonTerminating ?? false,
      version: data.version ?? 1,
      status: WorkflowStatus.DRAFT,
    },
  });
}

/**
 * Create a new workflow from a template (with provenance).
 * This is the ONLY function that may set provenance fields.
 * Provenance is immutable after this call.
 *
 * @param data - Workflow creation data
 * @param provenance - Template provenance (immutable after import)
 * @returns Created workflow
 */
export async function createWorkflowFromTemplate(
  data: CreateWorkflowData,
  provenance: TemplateProvenance
) {
  return prisma.workflow.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      description: data.description ?? null,
      isNonTerminating: data.isNonTerminating ?? false,
      version: data.version ?? 1,
      status: WorkflowStatus.DRAFT,
      // Provenance fields (write-once)
      templateId: provenance.templateId,
      templateVersion: provenance.templateVersion,
      importedAt: new Date(),
      importedBy: provenance.importedBy,
    },
  });
}

/**
 * Update a workflow.
 * Provenance fields (templateId, templateVersion, importedAt, importedBy)
 * are NOT in UpdateWorkflowData and cannot be modified.
 *
 * @param id - Workflow ID
 * @param data - Update data (provenance excluded)
 * @returns Updated workflow
 */
export async function updateWorkflow(id: string, data: UpdateWorkflowData) {
  return prisma.workflow.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      isNonTerminating: data.isNonTerminating,
      status: data.status,
      publishedAt: data.publishedAt,
    },
  });
}

/**
 * Delete a workflow with tenant verification.
 * Verifies the workflow belongs to the tenant before deletion.
 *
 * @param id - Workflow ID
 * @param tenantCtx - Tenant context from getActorTenantContext()
 * @throws Error if workflow not found or tenant mismatch
 */
export async function deleteWorkflow(id: string, tenantCtx: TenantContext): Promise<void> {
  // Fetch workflow to verify ownership
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    select: { companyId: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.companyId !== tenantCtx.companyId) {
    throw new Error("Tenant isolation violation: workflow does not belong to company");
  }

  await prisma.workflow.delete({
    where: { id },
  });
}

/**
 * Ensures a workflow is in DRAFT state before allowing structural edits.
 * 
 * POLICY B (Auto-Revert): 
 * If status is VALIDATED, automatically revert to DRAFT.
 * If status is PUBLISHED, reject (structural edits prohibited).
 * 
 * @param workflowId - The workflow ID
 * @param tx - Optional Prisma transaction client
 * @returns The workflow record (updated if needed)
 * @throws Error with code if workflow is PUBLISHED or not found
 */
export async function ensureDraftForStructuralEdit(
  workflowId: string,
  tx?: Prisma.TransactionClient
): Promise<{ status: WorkflowStatus }> {
  const client = tx || prisma;
  
  const workflow = await client.workflow.findUnique({
    where: { id: workflowId },
    select: { status: true }
  });

  if (!workflow) {
    const error = new Error("Workflow not found");
    (error as any).code = "WORKFLOW_NOT_FOUND";
    throw error;
  }

  if (workflow.status === WorkflowStatus.PUBLISHED) {
    const error = new Error("Published workflows cannot be modified (INV-011)");
    (error as any).code = "PUBLISHED_IMMUTABLE";
    throw error;
  }

  if (workflow.status === WorkflowStatus.VALIDATED) {
    // POLICY B: Auto-revert VALIDATED to DRAFT (INV-026)
    return client.workflow.update({
      where: { id: workflowId },
      data: { status: WorkflowStatus.DRAFT },
      select: { status: true }
    });
  }

  return { status: workflow.status };
}

/**
 * Publish a workflow: update status and create an immutable version snapshot.
 *
 * @param workflowId - Workflow ID
 * @param versionNumber - Version number to publish
 * @param snapshot - Complete workflow snapshot
 * @param publishedBy - User ID who published
 * @returns Updated workflow and created version
 */
export async function publishWorkflow(
  workflowId: string,
  versionNumber: number,
  snapshot: WorkflowSnapshot,
  publishedBy: string
) {
  return prisma.$transaction(async (tx) => {
    // 1. Create WorkflowVersion
    const version = await tx.workflowVersion.create({
      data: {
        workflowId,
        version: versionNumber,
        snapshot: snapshot as any,
        publishedBy,
      },
    });

    // 2. Update Workflow status and publishedAt
    const updated = await tx.workflow.update({
      where: { id: workflowId },
      data: {
        status: WorkflowStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    return { updated, version };
  });
}

// =============================================================================
// QUERY HELPERS (Read operations - no boundary enforcement needed)
// =============================================================================

/**
 * Find a workflow by ID with full relations.
 * Read operations don't require gateway enforcement.
 */
export async function findWorkflowById(id: string) {
  return prisma.workflow.findUnique({
    where: { id },
    include: {
      nodes: {
        include: {
          tasks: {
            include: {
              outcomes: true,
              crossFlowDependencies: true,
            },
          },
          outboundGates: true,
          inboundGates: true,
        },
      },
      gates: true,
      fanOutRules: true,
    },
  });
}

/**
 * Check if a workflow name already exists for a tenant.
 */
export async function workflowNameExists(
  companyId: string,
  name: string,
  version: number = 1,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.workflow.findFirst({
    where: {
      companyId,
      name,
      version,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return existing !== null;
}

// =============================================================================
// HYDRATION (SNAPSHOT TO DATABASE)
// =============================================================================

/**
 * Hydrates a WorkflowSnapshot into database rows within a transaction.
 *
 * This function creates:
 * - 1 Workflow row
 * - N Node rows
 * - N Task rows (with outcomes)
 * - N Gate rows
 *
 * All IDs are regenerated to ensure tenant-space uniqueness.
 *
 * NOTE: This is the ONLY place outside the simple CRUD methods above where
 * tx.workflow or prisma.workflow writes are permitted.
 *
 * @param tx - Prisma transaction client
 * @param snapshot - The WorkflowSnapshot to hydrate
 * @param options - Hydration options (companyId, version, provenance)
 * @returns HydrationResult with new workflow ID and ID mappings
 */
export async function hydrateSnapshotToWorkflow(
  tx: Prisma.TransactionClient,
  snapshot: WorkflowSnapshot,
  options: HydrationOptions
): Promise<HydrationResult> {
  const { companyId, version, provenance } = options;

  // 1. Create the new Workflow record
  const wf = await tx.workflow.create({
    data: {
      name: snapshot.name,
      description: snapshot.description,
      companyId,
      version,
      status: WorkflowStatus.DRAFT,
      isNonTerminating: snapshot.isNonTerminating,
      // Provenance fields (only set for template import)
      ...(provenance
        ? {
            templateId: provenance.templateId,
            templateVersion: provenance.templateVersion,
            importedAt: new Date(),
            importedBy: provenance.importedBy,
          }
        : {}),
    },
  });

  // Maps to track ID translation (old snapshot ID → new DB ID)
  const nodeIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();

  // 2. Create Nodes and Tasks
  for (const sNode of snapshot.nodes) {
    const newNode = await tx.node.create({
      data: {
        workflowId: wf.id,
        name: sNode.name,
        isEntry: sNode.isEntry,
        completionRule: sNode.completionRule,
        specificTasks: [], // Will update after tasks are created
      },
    });
    nodeIdMap.set(sNode.id, newNode.id);

    for (const sTask of sNode.tasks) {
      const newTask = await tx.task.create({
        data: {
          nodeId: newNode.id,
          name: sTask.name,
          instructions: sTask.instructions,
          evidenceRequired: sTask.evidenceRequired,
          evidenceSchema: sTask.evidenceSchema as Prisma.InputJsonValue,
          displayOrder: sTask.displayOrder,
          defaultSlaHours: sTask.defaultSlaHours ?? null,
        },
      });
      taskIdMap.set(sTask.id, newTask.id);

      // Create outcomes for the task
      for (const sOutcome of sTask.outcomes) {
        await tx.outcome.create({
          data: {
            taskId: newTask.id,
            name: sOutcome.name,
          },
        });
      }

      // Create cross-flow dependencies for the task
      for (const sDep of (sTask.crossFlowDependencies ?? [])) {
        await tx.crossFlowDependency.create({
          data: {
            taskId: newTask.id,
            sourceWorkflowId: sDep.sourceWorkflowId,
            sourceTaskPath: sDep.sourceTaskPath,
            requiredOutcome: sDep.requiredOutcome,
          },
        });
      }
    }
  }

  // 3. Update specificTasks for nodes (now that we have new task IDs)
  for (const sNode of snapshot.nodes) {
    if (sNode.specificTasks.length > 0) {
      const newSpecificTasks = sNode.specificTasks
        .map((oldId) => taskIdMap.get(oldId))
        .filter((id): id is string => id !== undefined);

      await tx.node.update({
        where: { id: nodeIdMap.get(sNode.id) },
        data: { specificTasks: newSpecificTasks },
      });
    }
  }

  // 4. Create Gates
  for (const sGate of snapshot.gates) {
    const sourceNodeId = nodeIdMap.get(sGate.sourceNodeId);
    if (!sourceNodeId) {
      throw new Error(`Gate references unknown source node: ${sGate.sourceNodeId}`);
    }

    await tx.gate.create({
      data: {
        workflowId: wf.id,
        sourceNodeId,
        outcomeName: sGate.outcomeName,
        targetNodeId: sGate.targetNodeId ? nodeIdMap.get(sGate.targetNodeId) ?? null : null,
      },
    });
  }

  return {
    workflowId: wf.id,
    nodeIdMap,
    taskIdMap,
  };
}

