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
 * @returns The FlowGroup record
 */
export async function getOrCreateFlowGroup(
  companyId: string,
  scope: Scope
): Promise<FlowGroup> {
  // Try to find existing Flow Group for this scope
  const existing = await prisma.flowGroup.findUnique({
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
  return prisma.flowGroup.create({
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
 * @returns True if they match or if no Flow Group exists for scope yet
 */
export async function verifyFlowGroupScopeMatch(
  flowGroupId: string,
  companyId: string,
  scope: Scope
): Promise<boolean> {
  const existing = await prisma.flowGroup.findUnique({
    where: {
      companyId_scopeType_scopeId: {
        companyId,
        scopeType: scope.type,
        scopeId: scope.id,
      },
    },
  });

  if (!existing) {
    // If no flow group exists for scope yet, any hint is "valid" in terms
    // of not conflicting with existing truth, but we will create a new
    // group anyway. However, if a flowGroupId is provided but doesn't exist,
    // or belongs to another scope, that's a problem.
    
    const hintGroup = await prisma.flowGroup.findUnique({
      where: { id: flowGroupId }
    });
    
    if (hintGroup) {
      // Hint exists but belongs to a different scope (since no group exists for THIS scope)
      return false;
    }
    
    return true;
  }

  return existing.id === flowGroupId;
}
