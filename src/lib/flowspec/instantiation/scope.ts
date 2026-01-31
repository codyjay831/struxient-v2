/**
 * FlowSpec Scope and Flow Group Mapping
 *
 * Canon Source: 00_flowspec_glossary.md §2.3.3
 *
 * Scope is the canonical identifier for the unit of work that a Flow Group represents.
 * There is a 1:1 relationship between a unique Scope and a Flow Group.
 */

import { prisma } from "../../prisma";
import type { Scope } from "../types";
import type { FlowGroup } from "@prisma/client";

/**
 * Gets or creates a Flow Group for a given Scope.
 *
 * @param companyId - The tenant ID
 * @param scope - The scope identifier (type and id)
 * @param tx - Optional Prisma transaction client
 * @returns The FlowGroup record
 */
export async function getOrCreateFlowGroup(
  companyId: string,
  scope: Scope,
  tx?: any
): Promise<FlowGroup> {
  const client = tx || prisma;
  // Try to find existing Flow Group for this scope
  const existing = await client.flowGroup.findUnique({
    where: {
      companyId_scopeType_scopeId: {
        companyId,
        scopeType: scope.type,
        scopeId: scope.id,
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Create new Flow Group
  return client.flowGroup.create({
    data: {
      companyId,
      scopeType: scope.type,
      scopeId: scope.id,
    },
  });
}

/**
 * Verifies that a flowGroupId matches the Flow Group associated with a Scope.
 * Canon: 00_flowspec_glossary.md §2.3.3 Rule 3
 *
 * @param flowGroupId - The provided flowGroupId hint
 * @param companyId - The tenant ID
 * @param scope - The scope identifier
 * @param tx - Optional Prisma transaction client
 * @returns True if they match or if no Flow Group exists for scope yet
 */
export async function verifyFlowGroupScopeMatch(
  flowGroupId: string,
  companyId: string,
  scope: Scope,
  tx?: any
): Promise<boolean> {
  const client = tx || prisma;
  const existing = await client.flowGroup.findUnique({
    where: {
      companyId_scopeType_scopeId: {
        companyId,
        scopeType: scope.type,
        scopeId: scope.id,
      },
    },
  });

  if (!existing) {
    const hintGroup = await client.flowGroup.findUnique({
      where: { id: flowGroupId }
    });
    
    if (hintGroup) {
      return false;
    }
    
    return true;
  }

  return existing.id === flowGroupId;
}
