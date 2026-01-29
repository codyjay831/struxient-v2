/**
 * FlowSpec Module - Public API
 *
 * Canon Source: 10_flowspec_engine_contract.md
 * Epic: EPIC-01 FlowSpec Engine Core
 *
 * This is the public API for the FlowSpec execution engine.
 * All external consumers should import from this module only.
 *
 * FOUNDATIONAL BOUNDARY:
 * FlowSpec is the sole engine responsible for defining and executing workflows.
 */

// =============================================================================
// ENGINE OPERATIONS (Primary API)
// =============================================================================

export {
  // Flow Operations
  getFlow,
  getWorkflowSnapshot,

  // Task Operations
  startTask,
  recordOutcome,
  attachEvidence,

  // Actionability Queries
  getActionableTasks,
  isTaskActionable,

  // Node Operations
  activateNode,
  activateEntryNodes,
} from "./engine";

// =============================================================================
// LIFECYCLE
// =============================================================================

export {
  validateWorkflowAction,
  publishWorkflowAction,
  revertToDraftAction,
  branchFromVersion,
} from "./lifecycle";
export type { LifecycleTransitionResult, PublishResult } from "./lifecycle/types";

// =============================================================================
// INSTANTIATION
// =============================================================================

export { createFlow } from "./instantiation";
export type { CreateFlowResult } from "./instantiation";

// =============================================================================
// VALIDATION
// =============================================================================

export { validateWorkflow } from "./validation";
export type {
  ValidationResult,
  ValidationError,
  ValidationErrorCategory,
  ValidationErrorSeverity,
} from "./validation";

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Specification Types
  WorkflowWithRelations,
  NodeWithRelations,
  TaskWithRelations,
  WorkflowSnapshot,
  SnapshotNode,
  SnapshotTask,
  SnapshotOutcome,
  SnapshotGate,

  // Runtime Types
  FlowWithRelations,
  Scope,

  // Truth Types
  NodeActivationEvent,
  TaskStartEvent,
  OutcomeEvent,
  EvidenceEvent,

  // Derived Types
  DerivedNodeState,
  DerivedTaskState,
  ActionableTask,

  // Operation Result Types
  RecordTaskStartResult,
  RecordOutcomeResult,
  GateEvaluationResult,
  NodeActivationResult,
  EngineError,
  EngineErrorCode,

  // Gate Types
  GateKey,
  GateRoute,
} from "./types";

// =============================================================================
// ENUMS
// =============================================================================

export {
  WorkflowStatus,
  FlowStatus,
  CompletionRule,
  EvidenceType,
} from "@prisma/client";

// =============================================================================
// TYPE GUARDS
// =============================================================================

export { isValidOutcome, isTerminalGate } from "./types";

// =============================================================================
// DERIVED STATE COMPUTATION (For testing/debugging)
// =============================================================================

export {
  computeActiveNodes,
  computeNodeStarted,
  computeNodeComplete,
  computeNodeState,
  computeTaskActionable,
  computeTaskState,
  computeActionableTasks,
  computeFlowComplete,
  evaluateGates,
  getGateRoute,
} from "./derived";
