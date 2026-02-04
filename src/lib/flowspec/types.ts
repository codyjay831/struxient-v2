/**
 * FlowSpec Engine Core Types
 *
 * Canon Source: 00_flowspec_glossary.md, 10_flowspec_engine_contract.md
 * Epic: EPIC-01 FlowSpec Engine Core
 *
 * These types represent the core concepts of the FlowSpec execution engine.
 * Types are divided into:
 * - Specification Types (design-time, from Workflow definition)
 * - Runtime Types (execution-time, from Flow instances)
 * - Truth Types (immutable execution records)
 * - Derived Types (computed from Truth)
 */

import type {
  Workflow as PrismaWorkflow,
  WorkflowVersion as PrismaWorkflowVersion,
  Node as PrismaNode,
  Task as PrismaTask,
  Outcome as PrismaOutcome,
  Gate as PrismaGate,
  Flow as PrismaFlow,
  FlowGroup as PrismaFlowGroup,
  NodeActivation as PrismaNodeActivation,
  TaskExecution as PrismaTaskExecution,
  EvidenceAttachment as PrismaEvidenceAttachment,
  DetourRecord as PrismaDetourRecord,
  CrossFlowDependency as PrismaCrossFlowDependency,
  FanOutRule as PrismaFanOutRule,
} from "@prisma/client";
import {
  WorkflowStatus,
  FlowStatus,
  CompletionRule,
  EvidenceType,
  Prisma,
  NodeKind,
} from "@prisma/client";

// Re-export Prisma enums for convenience
export { WorkflowStatus, FlowStatus, CompletionRule, EvidenceType, NodeKind };

// =============================================================================
// PRISMA PAYLOAD TYPES
// =============================================================================

export const FLOW_WITH_RELATIONS_INCLUDE = {
  workflow: true,
  workflowVersion: true,
  flowGroup: {
    include: {
      job: {
        select: {
          id: true,
          customerId: true
        }
      }
    }
  },
  nodeActivations: true,
  taskExecutions: {
    include: {
      validityEvents: true,
    },
  },
  evidenceAttachments: true,
  detours: true,
} as const;

/**
 * Flow with all execution-related entities loaded.
 */
export type FlowWithRelations = Prisma.FlowGetPayload<{
  include: typeof FLOW_WITH_RELATIONS_INCLUDE;
}>;

/**
 * Workflow specification with all related entities loaded.
 * This is the complete design-time representation of a workflow.
 */
export interface WorkflowWithRelations extends PrismaWorkflow {
  nodes: NodeWithRelations[];
  gates: PrismaGate[];
  fanOutRules: PrismaFanOutRule[];
}

/**
 * Node with all related entities loaded.
 */
export interface NodeWithRelations extends PrismaNode {
  tasks: TaskWithRelations[];
  outboundGates: PrismaGate[];
  inboundGates: PrismaGate[];
}

/**
 * Task with all related entities loaded.
 */
export interface TaskWithRelations extends PrismaTask {
  outcomes: PrismaOutcome[];
  crossFlowDependencies: PrismaCrossFlowDependency[];
}

/**
 * Workflow version snapshot - immutable after publish.
 * The snapshot JSON contains the complete workflow structure at publish time.
 */
export interface WorkflowSnapshot {
  workflowId: string;
  version: number;
  name: string;
  description: string | null;
  isNonTerminating: boolean;
  nodes: SnapshotNode[];
  gates: SnapshotGate[];
}

export interface SnapshotNode {
  id: string;
  name: string;
  isEntry: boolean;
  nodeKind: NodeKind;
  completionRule: CompletionRule;
  specificTasks: string[];
  tasks: SnapshotTask[];
  transitiveSuccessors: string[]; // Node IDs reachable from this node
}

export interface SnapshotTask {
  id: string;
  name: string;
  instructions: string | null;
  evidenceRequired: boolean;
  evidenceSchema: unknown | null;
  displayOrder: number;
  defaultSlaHours?: number | null; // Template-level default SLA (A). Policy can override (B > A > null)
  outcomes: SnapshotOutcome[];
  crossFlowDependencies?: SnapshotCrossFlowDependency[];
}

export interface SnapshotCrossFlowDependency {
  id: string;
  sourceWorkflowId: string;
  sourceTaskPath: string;
  requiredOutcome: string;
}

export interface SnapshotOutcome {
  id: string;
  name: string;
}

/**
 * Outcome recorded within a Flow Group.
 * Used for evaluating Cross-Flow Dependencies.
 */
export interface GroupOutcome {
  workflowId: string;
  taskId: string;
  outcome: string;
}

export interface SnapshotGate {
  id: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null;
}

// =============================================================================
// EXPLAINER & REFUSAL TYPES
// =============================================================================

export type ReasonCode =
  | "NODE_NOT_ACTIVE"
  | "NODE_COMPLETE"
  | "OUTCOME_ALREADY_RECORDED"
  | "ACTIVE_BLOCKING_DETOUR"
  | "JOIN_BLOCKED"
  | "NESTED_DETOUR_FORBIDDEN"
  | "CROSS_FLOW_DEP_MISSING"
  | "EXPLAINER_COVERAGE_GAP";

export interface ActionRefusal {
  reasonCode: ReasonCode;
  message: string;
  requiredActions?: string[];
}

// =============================================================================
// RUNTIME TYPES (EXECUTION-TIME)
// =============================================================================

/**
 * Scope identifier for Flow Group binding.
 * Canon: 00_flowspec_glossary.md §2.3.3
 */
export interface Scope {
  type: string; // e.g., "job", "project", "engagement"
  id: string; // unique identifier within the type
}

// =============================================================================
// TRUTH TYPES (IMMUTABLE EXECUTION RECORDS)
// Canon: 00_flowspec_glossary.md §3.1
// =============================================================================

/**
 * Node activation event shape (Truth).
 * Canon: 10_flowspec_engine_contract.md §5.2.1
 */
export interface NodeActivationEvent {
  flowId: string;
  nodeId: string;
  activatedAt: Date;
  iteration: number;
}

/**
 * Task start event shape (Truth).
 */
export interface TaskStartEvent {
  flowId: string;
  taskId: string;
  startedAt: Date;
  startedBy: string;
  iteration: number;
}

/**
 * Outcome recording event shape (Truth).
 * INV-007: Outcome immutability - once recorded, cannot be changed.
 */
export interface OutcomeEvent {
  flowId: string;
  taskId: string;
  outcome: string;
  outcomeAt: Date;
  outcomeBy: string;
  iteration: number;
}

/**
 * Evidence attachment event shape (Truth).
 * INV-005: No floating evidence - always attached to a Task.
 */
export interface EvidenceEvent {
  flowId: string;
  taskId: string;
  type: EvidenceType;
  data: unknown;
  attachedAt: Date;
  attachedBy: string;
  idempotencyKey?: string;
}

// =============================================================================
// DERIVED TYPES (COMPUTED FROM TRUTH)
// Canon: 00_flowspec_glossary.md §3.2
// =============================================================================

/**
 * Derived state for a Node within a Flow.
 */
export interface DerivedNodeState {
  nodeId: string;
  isActive: boolean;
  isStarted: boolean;
  isComplete: boolean;
  currentIteration: number;
}

/**
 * Derived state for a Task within a Flow.
 * INV-019: FlowSpec evaluates all Actionability.
 */
export interface DerivedTaskState {
  taskId: string;
  nodeId: string;
  isActionable: boolean;
  isStarted: boolean;
  hasOutcome: boolean;
  currentIteration: number;
  outcome?: string;
}

/**
 * Actionable task information returned to consumers.
 * Canon: 10_flowspec_engine_contract.md §9.1
 */
export interface ActionableTask {
  flowId: string;
  flowGroupId: string;
  workflowId: string;
  workflowName: string;
  taskId: string;
  taskName: string;
  nodeId: string;
  nodeName: string;
  instructions: string | null;
  allowedOutcomes: string[];
  evidenceRequired: boolean;
  evidenceSchema: unknown | null;
  iteration: number;
  domainHint: "execution" | "finance" | "sales";
  startedAt: Date | null;
  latestTaskExecutionId?: string | null;
  _detour?: {
    id: string;
    status: 'ACTIVE' | 'RESOLVED' | 'CONVERTED';
    type: 'NON_BLOCKING' | 'BLOCKING';
  };
  diagnostics?: {
    evidence?: {
      required: boolean;
      status: "missing" | "present" | "unknown";
      reason?: string;
    };
  };
  context?: {
    jobId?: string;
    customerId?: string;
  };
  _signals?: {
    jobPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    effectiveSlaHours: number | null;
    effectiveDueAt: string | null;
    isOverdue: boolean;
    isDueSoon: boolean;
  };
  recommendations?: Array<{
    kind: "open_task" | "open_job" | "open_customer" | "open_settings";
    label: string;
    href?: string;
    reason: string;
    severity?: "info" | "warn" | "block";
  }>;
}

// =============================================================================
// DOMAIN-SPECIFIC STRUCTURED EVIDENCE TYPES
// =============================================================================

/**
 * Anchor Identity - captured at the start of a FlowGroup.
 * B1 strategy: stored as structured evidence on the Anchor Task.
 */
export interface AnchorIdentity {
  customerId: string;
}

/**
 * Sale Details - captured when a sale is closed (SALE_CLOSED).
 * Used for Job provisioning and Anchor Identity verification.
 */
export interface SaleDetails {
  customerId: string;
  serviceAddress: string;
  packageId?: string;
  contractValue?: number;
}

// =============================================================================
// ENGINE OPERATION TYPES
// =============================================================================

/**
 * Result of recording a task start.
 */
export interface RecordTaskStartResult {
  success: boolean;
  taskExecutionId?: string;
  error?: EngineError;
}

/**
 * Result of recording an outcome.
 */
export interface RecordOutcomeResult {
  success: boolean;
  taskExecutionId?: string;
  gateResults?: GateEvaluationResult[];
  error?: EngineError;
}

/**
 * Result of gate evaluation.
 */
export interface GateEvaluationResult {
  gateId: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null; // null = terminal
  activated: boolean;
  error?: EngineError;
}

/**
 * Result of node activation.
 */
export interface NodeActivationResult {
  success: boolean;
  nodeActivationId?: string;
  iteration?: number;
  error?: EngineError;
}

/**
 * Engine error types.
 */
export type EngineErrorCode =
  | "TASK_NOT_ACTIONABLE"
  | "TASK_ALREADY_STARTED"
  | "TASK_NOT_STARTED"
  | "OUTCOME_ALREADY_RECORDED"
  | "INVALID_OUTCOME"
  | "EVIDENCE_REQUIRED"
  | "INVALID_EVIDENCE_FORMAT"
  | "FLOW_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "NODE_NOT_FOUND"
  | "WORKFLOW_NOT_PUBLISHED"
  | "ITERATION_LIMIT_EXCEEDED"
  | "CONCURRENT_MODIFICATION"
  | "FLOW_BLOCKED"
  | "INVALID_FILE_POINTER"
  | "STORAGE_KEY_TENANT_MISMATCH"
  | "DETOUR_SPOOF"
  | "INVALID_DETOUR"
  | "DETOUR_HIJACK"
  | "NESTED_DETOUR_FORBIDDEN";

export interface EngineError {
  code: EngineErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// GATE ROUTING TYPES
// =============================================================================

/**
 * Gate key - Gates are keyed by (nodeId, outcomeName).
 * INV-024: Gate key is Node-level.
 */
export interface GateKey {
  nodeId: string;
  outcomeName: string;
}

/**
 * Gate route definition.
 */
export interface GateRoute {
  gateId: string;
  sourceNodeId: string;
  outcomeName: string;
  targetNodeId: string | null; // null = terminal path
}

// =============================================================================
// ANALYSIS & DIAGNOSIS TYPES
// =============================================================================

/**
 * Result of a publish-time impact analysis.
 */
export interface PublishImpactReport {
  breakingChanges: ImpactBreakingChange[];
  activeFlowsCount: number;
  isAnalysisComplete: boolean;
  timestamp: Date;
}

/**
 * A specific breaking change detected during analysis.
 */
export interface ImpactBreakingChange {
  type: "OUTCOME_RENAME" | "NODE_DELETION" | "TASK_PATH_SHIFT" | "JOIN_SEMANTIC_SHIFT";
  severity: "HIGH" | "MEDIUM";
  message: string;
  affectedFlowsCount: number;
  details: Record<string, unknown>;
}

/**
 * Diagnosis of why a Flow is stalled.
 */
export interface StallDiagnosis {
  isStalled: boolean;
  reasonCode?: StallReasonCode;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Stall reason codes.
 */
export type StallReasonCode =
  | "ERR_CFD_NAME"      // Waiting for outcome that no longer exists in target
  | "ERR_CFD_PATH"      // Task path referenced in CFD is unreachable/deleted
  | "ERR_ORPHAN_FANOUT" // Node complete but fan-out rule missing
  | "ERR_DEAD_GATE"     // Outcome recorded but no gate exists for it
  | "ERR_SCHEMA_LOCK"   // Evidence required but schema missing or invalid
  | "ERR_LOGIC_DEADLOCK"; // Circular dependencies between flows

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isValidOutcome(
  outcome: string,
  allowedOutcomes: string[]
): boolean {
  return allowedOutcomes.includes(outcome);
}

export function isTerminalGate(gate: GateRoute): boolean {
  return gate.targetNodeId === null;
}
