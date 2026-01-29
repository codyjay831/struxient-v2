/**
 * FlowSpec Workflow Lifecycle Types
 *
 * Canon Source: 10_flowspec_engine_contract.md §7
 */

import type { WorkflowStatus, WorkflowWithRelations, ValidationResult } from "../types";

export interface LifecycleTransitionResult {
  success: boolean;
  from: WorkflowStatus;
  to: WorkflowStatus;
  workflow?: WorkflowWithRelations;
  validation?: ValidationResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface PublishResult extends LifecycleTransitionResult {
  versionId?: string;
  version?: number;
}
