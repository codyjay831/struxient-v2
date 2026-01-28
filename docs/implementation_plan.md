# Struxient v2 Implementation Plan

**Document ID:** implementation_plan  
**Status:** ACTIVE  
**Last Updated:** 2026-01-28  
**Derived From:** Canon documentation (FlowSpec, Workstation, Permissions)

---

## 1. Executive Summary

This implementation plan defines the build sequence for Struxient v2's core workflow and execution systems. The plan is derived entirely from canonical documentation and organizes work into 9 epics with clear dependencies.

### 1.1 Core Systems

| System | Purpose | Canon Source |
|--------|---------|--------------|
| **FlowSpec Engine** | Workflow definition and execution engine | `docs/canon/flowspec/` |
| **FlowSpec Builder** | Visual workflow editor | `40_flowspec_builder_contract.md` |
| **Work Station** | Human task execution surface | `docs/canon/workstation/` |
| **Permissions** | Capability-based data visibility | `docs/canon/permissions/` |

### 1.2 Foundational Boundary

> **FlowSpec is the sole engine responsible for defining and executing workflows. The Work Station does not execute workflows; it exists solely to perform and submit human work (tasks) into FlowSpec.**

This boundary is non-negotiable and informs all architectural decisions.

### 1.3 Authorization Layer (Tenant Isolation)

> **The Authorization Layer enforces tenant boundaries only. It verifies that an authenticated actor belongs to the same company as the resource being accessed before allowing the operation to proceed.**

This layer exists to prevent cross-tenant data access. It runs **upstream** of FlowSpec truth mutations and lifecycle actions.

#### 1.3.1 Scope

| In Scope | Out of Scope |
|----------|--------------|
| Verify actor's `companyId` matches resource's `companyId` | Role-based access control (RBAC) |
| Reject requests that fail tenant ownership check | Per-task or per-workflow assignment |
| Scope queries to actor's tenant | User-to-resource authorization rules |
| | Workflow semantics, Actionability, or execution logic |

#### 1.3.2 Enforcement Points

| Surface | Authorization Check |
|---------|---------------------|
| Builder API (EPIC-07) | Actor's `companyId` must match Workflow's `companyId` |
| Lifecycle Actions (EPIC-04) | Actor's `companyId` must match Workflow's `companyId` |
| Flow Instantiation (EPIC-03) | Actor's `companyId` must match Workflow's `companyId` |
| Truth Mutations (EPIC-01) | Actor's `companyId` must match Flow's `companyId` |
| Work Station Queries (EPIC-08) | Queries are scoped to actor's `companyId` |
| Work Station Submissions (EPIC-08) | Actor's `companyId` must match Flow's `companyId` |

#### 1.3.3 Relationship to Other Systems

| System | Relationship |
|--------|--------------|
| **Clerk (Authentication)** | Provides authenticated identity; Authorization Layer uses `companyId` from session |
| **FlowSpec Engine** | Receives requests only after Authorization Layer has validated tenant ownership |
| **Permissions (EPIC-09)** | Handles data shaping (cost visibility); Authorization Layer handles tenant boundaries |

#### 1.3.4 Explicit Non-Goals

The Authorization Layer **MUST NOT**:
- Define roles, capabilities, or permission levels
- Implement per-user, per-task, or per-workflow access rules
- Determine who within a tenant can perform specific actions
- Affect Actionability, Gate routing, or any FlowSpec logic
- Replace or extend EPIC-09 Permissions (which handles data shaping)

> **Implementation Note:** Within a tenant, all authenticated members can access all tenant resources. Fine-grained authorization (if ever needed) is a future concern and is explicitly out of scope for v2.

---

## 2. Epic Dependency Graph

```
                    ┌─────────────────┐
                    │   EPIC-01       │
                    │ Engine Core     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  EPIC-02   │ │  EPIC-03   │ │  EPIC-06   │
       │ Validation │ │   Flow     │ │  Evidence  │
       │            │ │ Instantiate│ │   System   │
       └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                            ▼
                     ┌────────────┐
                     │  EPIC-04   │
                     │ Workflow   │
                     │ Lifecycle  │
                     └─────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  EPIC-05   │ │  EPIC-07   │ │  EPIC-09   │
       │ Cross-Flow │ │ Builder    │ │ Permissions│
       │Dependencies│ │    API     │ │Enforcement │
       └─────┬──────┘ └─────┬──────┘ └────────────┘
             │              │
             └──────┬───────┘
                    │
                    ▼
             ┌────────────┐
             │  EPIC-08   │
             │ Work       │
             │ Station    │
             └────────────┘
```

### 2.1 Critical Path

The critical path for a minimal viable product:

1. **EPIC-01** → Engine Core (execution foundation)
2. **EPIC-02** → Validation (workflow correctness)
3. **EPIC-06** → Evidence System (task completion requirements)
4. **EPIC-04** → Workflow Lifecycle (publish workflows)
5. **EPIC-03** → Flow Instantiation (create live executions)
6. **EPIC-07** → Builder API (create workflows programmatically)
7. **EPIC-08** → Work Station (human execution surface)

### 2.2 Parallel Workstreams

After EPIC-01 completes, these can proceed in parallel:
- EPIC-02 + EPIC-06 (both depend only on EPIC-01)
- EPIC-03 (depends on EPIC-01)

After EPIC-04 completes:
- EPIC-05 + EPIC-07 + EPIC-09 (can proceed in parallel)

---

## 3. Database Schema Requirements

### 3.1 Core FlowSpec Models

Based on canon, the following Prisma models are required:

```prisma
// Workflow specification (design-time)
model Workflow {
  id              String           @id @default(cuid())
  name            String
  description     String?
  status          WorkflowStatus   @default(DRAFT)
  version         Int              @default(1)
  isNonTerminating Boolean         @default(false)
  companyId       String
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  publishedAt     DateTime?
  
  nodes           Node[]
  gates           Gate[]
  versions        WorkflowVersion[]
  flows           Flow[]
  
  company         Company          @relation(fields: [companyId], references: [id])
  
  @@unique([companyId, name, version])
  @@index([companyId])
}

enum WorkflowStatus {
  DRAFT
  VALIDATED
  PUBLISHED
}

// Immutable published version
model WorkflowVersion {
  id              String           @id @default(cuid())
  workflowId      String
  version         Int
  snapshot        Json             // Complete workflow structure at publish time
  publishedAt     DateTime         @default(now())
  publishedBy     String
  
  workflow        Workflow         @relation(fields: [workflowId], references: [id])
  flows           Flow[]
  
  @@unique([workflowId, version])
}

// Node container
model Node {
  id              String           @id @default(cuid())
  workflowId      String
  name            String
  isEntry         Boolean          @default(false)
  completionRule  CompletionRule   @default(ALL_TASKS_DONE)
  specificTasks   String[]         // For SPECIFIC_TASKS_DONE rule
  position        Json?            // { x: number, y: number } for Builder
  
  workflow        Workflow         @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  tasks           Task[]
  outboundGates   Gate[]           @relation("SourceNode")
  inboundGates    Gate[]           @relation("TargetNode")
  
  @@unique([workflowId, name])
}

enum CompletionRule {
  ALL_TASKS_DONE
  ANY_TASK_DONE
  SPECIFIC_TASKS_DONE
}

// Task definition
model Task {
  id                    String              @id @default(cuid())
  nodeId                String
  name                  String
  instructions          String?
  evidenceRequired      Boolean             @default(false)
  evidenceSchema        Json?
  displayOrder          Int                 @default(0)
  
  node                  Node                @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  outcomes              Outcome[]
  crossFlowDependencies CrossFlowDependency[]
  
  @@unique([nodeId, name])
}

// Outcome definition
model Outcome {
  id              String           @id @default(cuid())
  taskId          String
  name            String           // e.g., "APPROVED", "REJECTED"
  
  task            Task             @relation(fields: [taskId], references: [id], onDelete: Cascade)
  
  @@unique([taskId, name])
}

// Gate routing rule
model Gate {
  id              String           @id @default(cuid())
  workflowId      String
  sourceNodeId    String
  outcomeName     String           // Routes by outcome name at Node level
  targetNodeId    String?          // null = terminal
  
  workflow        Workflow         @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  sourceNode      Node             @relation("SourceNode", fields: [sourceNodeId], references: [id], onDelete: Cascade)
  targetNode      Node?            @relation("TargetNode", fields: [targetNodeId], references: [id], onDelete: SetNull)
  
  @@unique([workflowId, sourceNodeId, outcomeName])
}

// Cross-flow dependency definition
model CrossFlowDependency {
  id                String           @id @default(cuid())
  taskId            String
  sourceWorkflowId  String
  sourceTaskPath    String           // "nodeId.taskId" or similar identifier
  requiredOutcome   String
  
  task              Task             @relation(fields: [taskId], references: [id], onDelete: Cascade)
  
  @@index([taskId])
}
```

### 3.2 Flow Execution Models (Runtime)

```prisma
// Flow Group - groups related flows
model FlowGroup {
  id              String           @id @default(cuid())
  scopeType       String           // "job", "project", etc.
  scopeId         String           // Unique ID within scope type
  companyId       String
  createdAt       DateTime         @default(now())
  
  flows           Flow[]
  company         Company          @relation(fields: [companyId], references: [id])
  
  @@unique([companyId, scopeType, scopeId])
}

// Flow instance (runtime)
model Flow {
  id                    String           @id @default(cuid())
  workflowId            String
  workflowVersionId     String
  flowGroupId           String
  status                FlowStatus       @default(ACTIVE)
  createdAt             DateTime         @default(now())
  completedAt           DateTime?
  
  workflow              Workflow         @relation(fields: [workflowId], references: [id])
  workflowVersion       WorkflowVersion  @relation(fields: [workflowVersionId], references: [id])
  flowGroup             FlowGroup        @relation(fields: [flowGroupId], references: [id])
  nodeActivations       NodeActivation[]
  taskExecutions        TaskExecution[]
  evidenceAttachments   EvidenceAttachment[]
  
  @@index([flowGroupId])
  @@index([workflowId])
}

enum FlowStatus {
  ACTIVE
  COMPLETED
  SUSPENDED
  BLOCKED       // Fan-out failure; visible, terminal for v2
}

// Node activation event (Truth)
model NodeActivation {
  id              String           @id @default(cuid())
  flowId          String
  nodeId          String
  activatedAt     DateTime         @default(now())
  iteration       Int              @default(1) // For cycle tracking
  
  flow            Flow             @relation(fields: [flowId], references: [id], onDelete: Cascade)
  
  @@index([flowId, nodeId])
}

// Task execution state (Truth)
model TaskExecution {
  id              String           @id @default(cuid())
  flowId          String
  taskId          String
  nodeActivationId String?         // Links to which node activation
  startedAt       DateTime?
  startedBy       String?
  outcome         String?          // Recorded outcome
  outcomeAt       DateTime?
  outcomeBy       String?
  iteration       Int              @default(1) // For cycle tracking
  
  flow            Flow             @relation(fields: [flowId], references: [id], onDelete: Cascade)
  
  @@index([flowId, taskId])
}

// Evidence attachment (Truth)
model EvidenceAttachment {
  id              String           @id @default(cuid())
  flowId          String
  taskId          String
  taskExecutionId String?
  type            EvidenceType
  data            Json             // File reference or content
  attachedAt      DateTime         @default(now())
  attachedBy      String
  idempotencyKey  String?
  
  flow            Flow             @relation(fields: [flowId], references: [id], onDelete: Cascade)
  
  @@unique([idempotencyKey])
  @@index([flowId, taskId])
}

enum EvidenceType {
  FILE
  TEXT
  STRUCTURED
}
```

### 3.3 Fan-Out Configuration

```prisma
// Fan-out rule (stored in Workflow specification)
model FanOutRule {
  id                String           @id @default(cuid())
  workflowId        String
  sourceNodeId      String
  triggerOutcome    String
  targetWorkflowId  String
  
  @@index([workflowId])
}

// Fan-out failure log
model FanOutFailure {
  id                    String           @id @default(cuid())
  triggeringFlowId      String
  triggeringTaskId      String
  triggeringOutcome     String
  targetWorkflowId      String
  errorReason           String
  createdAt             DateTime         @default(now())
  retriedAt             DateTime?
  resolved              Boolean          @default(false)
  
  @@index([triggeringFlowId])
  @@index([resolved])
}
```

---

## 4. Epic Implementation Details

### Phase 1: Foundation

---

### EPIC-01: FlowSpec Engine Core

**Priority:** P0 (Critical Path)  
**Dependencies:** None  
**Canon Source:** `10_flowspec_engine_contract.md`, `20_flowspec_invariants.md`

#### Authorization Requirement

> **Tenant Isolation:** All Truth mutation functions (`recordTaskStart`, `recordOutcome`, `attachEvidence`) receive requests only after the API layer has verified that the actor's `companyId` matches the Flow's `companyId`. The engine itself does NOT perform authorization checks—it trusts that upstream validation has occurred.

#### Objectives

Implement the execution engine that:
- Records and persists execution Truth
- Computes Derived State (Actionability)
- Evaluates Gate routing
- Enforces Node completion rules
- Supports workflow cycles

#### Implementation Steps

1. **Core Types & Interfaces**
   ```
   src/lib/flowspec/
   ├── types.ts           # Core type definitions
   ├── engine.ts          # Main engine class
   ├── truth.ts           # Truth persistence layer
   └── derived.ts         # Derived state computation
   ```

2. **Truth Recording Functions**
   - `recordNodeActivation(flowId, nodeId)` → persists NodeActivation
   - `recordTaskStart(flowId, taskId, userId)` → persists TaskExecution.startedAt
   - `recordOutcome(flowId, taskId, outcome, userId)` → persists TaskExecution.outcome

3. **Derived State Computation**
   - `getActiveNodes(flowId)` → compute from NodeActivation events
   - `getActionableTasks(flowId)` → compute from active nodes, outcomes, constraints
   - `isNodeComplete(flowId, nodeId)` → apply completion rule to task outcomes
   - `isFlowComplete(flowId)` → all terminal paths reached

4. **Gate Evaluation**
   - `evaluateGates(flowId, nodeId, outcome)` → determine target nodes
   - `activateNode(flowId, nodeId)` → create NodeActivation, handle cycles

5. **Cycle Support**
   - Track iteration count per Node activation
   - New outcomes recorded as new entries (not overwrites)
   - Previous outcomes preserved in audit trail

#### Key Invariants to Enforce

| ID | Invariant | Implementation |
|----|-----------|----------------|
| INV-001 | No Work Outside Tasks | All mutations require taskId |
| INV-002 | Explicit Outcomes Only | Validate against allowed outcomes |
| INV-006 | Determinism | Pure functions for derived state |
| INV-007 | Outcome Immutability | Reject duplicate outcome recording |
| INV-009 | FlowSpec Owns Truth | No direct DB access from consumers |

#### Acceptance Criteria

- [ ] Task can only start if Actionable
- [ ] Task start is recorded in Truth with timestamp
- [ ] Outcome must be in Task's allowed Outcomes list
- [ ] Outcome recording triggers Gate evaluation
- [ ] Gate routes to correct target Node(s) based on Outcome
- [ ] Node re-activation in cycles creates new entries
- [ ] Determinism: replay of Truth produces identical Derived State
- [ ] Node completion rules (ALL, ANY, SPECIFIC) work correctly
- [ ] **Tenant Isolation:** API layer rejects Truth mutations where actor's `companyId` ≠ Flow's `companyId`

---

### EPIC-02: FlowSpec Validation

**Priority:** P0 (Critical Path)  
**Dependencies:** EPIC-01  
**Canon Source:** `10_flowspec_engine_contract.md §8`

#### Objectives

Implement comprehensive validation that ensures Workflows are structurally sound before publishing.

#### Implementation Steps

1. **Validation Module**
   ```
   src/lib/flowspec/
   └── validation/
       ├── index.ts           # Main validate function
       ├── structural.ts      # Entry nodes, reachability
       ├── outcomes.ts        # Outcome/Gate completeness
       ├── evidence.ts        # Evidence schema validation
       ├── semantic.ts        # Completion rules, cycles
       └── cross-flow.ts      # Cross-flow dependency validation
   ```

2. **Structural Validation**
   - Entry Node exists (at least one)
   - All Nodes reachable from Entry
   - No orphan Tasks
   - Terminal path exists (or explicit non-terminating)

3. **Outcome/Gate Validation**
   - All Tasks have Outcomes
   - All Outcomes have Gate routes
   - Gate targets exist
   - No conflicting routes within Node (same outcome → different targets)

4. **Evidence Validation**
   - Evidence schemas well-formed
   - Required Evidence achievable

5. **Semantic Validation**
   - Completion rules reference valid Tasks
   - Cycle acknowledgment (if policy requires)

6. **Error Format**
   ```typescript
   interface ValidationError {
     severity: 'error' | 'warning';
     category: 'structural' | 'outcome_gate' | 'evidence' | 'semantic' | 'cross_flow';
     path: string;          // e.g., "nodes[0].tasks[2].outcomes"
     code: string;          // e.g., "ORPHANED_OUTCOME"
     message: string;
     suggestion?: string;
   }
   ```

#### Acceptance Criteria

- [ ] Detects missing Entry Node
- [ ] Detects unreachable Nodes
- [ ] Detects Tasks with zero Outcomes
- [ ] Detects Outcomes without Gate routes
- [ ] Detects Gate targets that don't exist
- [ ] Returns ALL errors, not just first
- [ ] Each error includes severity, location, description
- [ ] Zero errors allows transition to Validated

---

### EPIC-06: FlowSpec Evidence System

**Priority:** P0 (Critical Path)  
**Dependencies:** EPIC-01  
**Canon Source:** `10_flowspec_engine_contract.md §5.3`, `20_flowspec_invariants.md INV-005, INV-016`

#### Objectives

Implement Evidence attachment and requirements enforcement.

#### Implementation Steps

1. **Evidence Module**
   ```
   src/lib/flowspec/
   └── evidence/
       ├── index.ts           # Main functions
       ├── schema.ts          # Schema validation
       └── requirements.ts    # Requirement checking
   ```

2. **Evidence Attachment**
   - `attachEvidence(flowId, taskId, evidence, userId, idempotencyKey)` → persists EvidenceAttachment
   - Validates against task's evidence schema
   - Returns evidenceId on success

3. **Evidence Requirements**
   - `checkEvidenceRequirements(flowId, taskId)` → boolean
   - Called at Outcome recording time
   - Rejects Outcome if requirements not satisfied

4. **Evidence Types**
   - File: mimeTypes, maxSize validation
   - Text: maxLength validation
   - Structured: JSON schema validation

#### Key Invariants

| ID | Invariant | Implementation |
|----|-----------|----------------|
| INV-005 | No Floating Evidence | taskId required for attachment |
| INV-016 | Evidence at Recording | Check at Outcome recording time |

#### Acceptance Criteria

- [ ] Evidence can be attached to a Task
- [ ] Evidence attachment is recorded in Truth
- [ ] Evidence cannot be deleted after attachment
- [ ] Evidence validates against schema
- [ ] Outcome recording fails if required Evidence not attached
- [ ] Multiple Evidence items can be attached to same Task

---

### Phase 2: Lifecycle & Instantiation

---

### EPIC-04: FlowSpec Workflow Lifecycle

**Priority:** P0 (Critical Path)  
**Dependencies:** EPIC-02, EPIC-06  
**Canon Source:** `10_flowspec_engine_contract.md §7`

#### Authorization Requirement

> **Tenant Isolation:** All lifecycle transitions (`validate`, `publish`, `revertToDraft`, `createDraftFromVersion`) require that the actor's `companyId` matches the Workflow's `companyId`. The API layer validates this before invoking lifecycle logic.

#### Objectives

Implement the Workflow state machine: Draft → Validated → Published.

#### Implementation Steps

1. **Lifecycle Module**
   ```
   src/lib/flowspec/
   └── lifecycle/
       ├── index.ts           # State transitions
       └── versioning.ts      # Version management
   ```

2. **State Transitions**
   - `validate(workflowId)` → Draft → Validated (if valid)
   - `revertToDraft(workflowId)` → Validated → Draft
   - `publish(workflowId, userId)` → Validated → Published

3. **Version Management**
   - Create WorkflowVersion on publish
   - Snapshot entire workflow structure
   - Assign unique version identifier

4. **Immutability Enforcement**
   - Block PATCH/DELETE on Published workflows
   - Block direct modification of WorkflowVersion

5. **Branching**
   - `createDraftFromVersion(workflowId, versionId)` → new Draft

#### Acceptance Criteria

- [ ] Draft Workflows are editable
- [ ] Validate action transitions Draft → Validated (if valid)
- [ ] Publish requires passing validation
- [ ] Published Workflows cannot be modified
- [ ] Each Publish creates new version
- [ ] New Draft can be created from Published version
- [ ] **Tenant Isolation:** API layer rejects lifecycle transitions where actor's `companyId` ≠ Workflow's `companyId`

---

### EPIC-03: FlowSpec Flow Instantiation

**Priority:** P0 (Critical Path)  
**Dependencies:** EPIC-01, EPIC-04  
**Canon Source:** `00_flowspec_glossary.md §2.3`, `10_flowspec_engine_contract.md §10`

#### Authorization Requirement

> **Tenant Isolation:** Flow creation requires that the actor's `companyId` matches the Workflow's `companyId`. The API layer validates this before invoking instantiation logic. FlowGroups inherit `companyId` from the Workflow and are queryable only by members of that tenant.

#### Objectives

Create Flow instances from Published Workflows, manage Flow Groups via Scope.

#### Implementation Steps

1. **Instantiation Module**
   ```
   src/lib/flowspec/
   └── instantiation/
       ├── index.ts           # Flow creation
       ├── scope.ts           # Scope → FlowGroup mapping
       └── fanout.ts          # Fan-out execution
   ```

2. **Flow Creation**
   - `createFlow(workflowId, scope, flowGroupId?)` → creates Flow
   - Binds to latest Published version (or specific if provided)
   - Activates Entry Node(s)
   - Records NodeActivation events

3. **Scope Management**
   - Enforce Scope → FlowGroup 1:1
   - Create FlowGroup for new Scope
   - Validate flowGroupId hint if provided

4. **Fan-Out**
   - `executeFanOut(flowId, nodeId, outcome)` → instantiate target workflows
   - Resolve to Latest Published version
   - Log failures with context (triggering Flow, Outcome, target Workflow, error reason)
   - On failure: preserve Outcome, set Flow to BLOCKED state
   - No retry mechanism in v2 (explicitly deferred)

#### Key Constraints

- Flow Start ≠ Task Actionability (INV-020)
- Cross-Flow Dependencies must be evaluated
- Fan-out failure preserves Outcome but BLOCKS Flow (INV-023)

#### Acceptance Criteria

- [ ] Flow can only be created from Published Workflow
- [ ] Flow is bound to specific Workflow version
- [ ] Scope parameter is required
- [ ] FlowGroup created for new Scope
- [ ] Entry Nodes activated on Flow creation
- [ ] Fan-out resolves to Latest Published version
- [ ] Fan-out failure preserves Outcome (no rollback)
- [ ] Fan-out failure sets Flow to BLOCKED state
- [ ] No retry mechanism for fan-out failures (v2 deferral)
- [ ] **Tenant Isolation:** API layer rejects Flow creation where actor's `companyId` ≠ Workflow's `companyId`

---

### Phase 3: Advanced Features

---

### EPIC-05: Cross-Flow Dependencies

**Priority:** P1  
**Dependencies:** EPIC-03  
**Canon Source:** `00_flowspec_glossary.md §3.5`, `10_flowspec_engine_contract.md §11`

#### Objectives

Enable Tasks to gate Actionability based on Outcomes in other Flows within same Flow Group.

#### Implementation Steps

1. **Dependency Module**
   ```
   src/lib/flowspec/
   └── cross-flow/
       ├── index.ts           # Dependency evaluation
       └── validation.ts      # Builder validation
   ```

2. **Dependency Evaluation**
   - Include in `getActionableTasks()` computation
   - Check all Flows in FlowGroup for required Outcome
   - Return false if any dependency unsatisfied

3. **Validation**
   - Source Workflow exists and is Published
   - Source Task exists
   - Required Outcome is defined
   - Warn about circular dependencies

#### Algorithm

```typescript
function isCrossFlowDependencySatisfied(
  dependency: CrossFlowDependency,
  flowGroup: FlowGroup
): boolean {
  const flows = flowGroup.flows.filter(
    f => f.workflowId === dependency.sourceWorkflowId
  );
  
  for (const flow of flows) {
    const execution = flow.taskExecutions.find(
      te => te.taskId === dependency.sourceTaskPath && 
            te.outcome === dependency.requiredOutcome
    );
    if (execution) return true;
  }
  
  return false;
}
```

#### Acceptance Criteria

- [ ] Dependencies defined per-Task in Workflow
- [ ] Task with unsatisfied dependency is NOT Actionable
- [ ] Task becomes Actionable when dependency satisfied
- [ ] Dependencies only evaluate within Flow Group
- [ ] Started Task can complete even if dependency changes
- [ ] Validation warns about circular dependencies

---

### EPIC-07: FlowSpec Builder API

**Priority:** P1  
**Dependencies:** EPIC-04  
**Canon Source:** `50_flowspec_builder_ui_api_map.md`

#### Authorization Requirement

> **Tenant Isolation:** All Builder API routes require that the actor's `companyId` matches the Workflow's `companyId`. For creation endpoints, the new Workflow is assigned the actor's `companyId`. For all other endpoints (read, update, delete), the API layer validates tenant ownership before processing. List endpoints are scoped to return only Workflows where `companyId` matches the actor's tenant.

#### Objectives

Implement complete API for Builder UI operations.

#### Implementation Steps

1. **API Routes Structure**
   ```
   src/app/api/flowspec/
   ├── workflows/
   │   ├── route.ts                    # POST, GET
   │   └── [id]/
   │       ├── route.ts                # GET, PATCH, DELETE
   │       ├── nodes/
   │       │   ├── route.ts            # POST
   │       │   └── [nodeId]/
   │       │       ├── route.ts        # PATCH, DELETE
   │       │       └── tasks/
   │       │           ├── route.ts    # POST
   │       │           ├── reorder/
   │       │           │   └── route.ts
   │       │           └── [taskId]/
   │       │               ├── route.ts
   │       │               ├── outcomes/
   │       │               │   ├── route.ts
   │       │               │   └── [outcomeId]/
   │       │               │       └── route.ts
   │       │               ├── evidence-schema/
   │       │               │   └── route.ts
   │       │               └── cross-flow-dependencies/
   │       │                   ├── route.ts    # POST, GET
   │       │                   └── [depId]/
   │       │                       └── route.ts    # DELETE
   │       ├── gates/
   │       │   ├── route.ts
   │       │   └── [gateId]/
   │       │       └── route.ts
   │       ├── fan-out-rules/
   │       │   ├── route.ts    # POST, GET
   │       │   └── [ruleId]/
   │       │       └── route.ts    # DELETE
   │       ├── validate/
   │       │   └── route.ts
   │       ├── publish/
   │       │   └── route.ts
   │       └── versions/
   │           ├── route.ts
   │           └── [versionId]/
   │               ├── route.ts
   │               └── branch/
   │                   └── route.ts
   ```

2. **All Routes Must Include**
   ```typescript
   export const dynamic = "force-dynamic";
   ```

3. **API Design Rules**
   - Authentication required
   - All responses include timestamp
   - Errors include code, message, details
   - List responses include pagination
   - IDs are opaque strings (cuid)

4. **Forbidden Routes**
   - No PATCH/DELETE on recorded Outcomes
   - No PATCH on Published Workflows
   - No modification of Flow's bound version

#### Acceptance Criteria

- [ ] Complete Workflow CRUD
- [ ] Complete Node CRUD
- [ ] Complete Task CRUD
- [ ] Complete Outcome CRUD
- [ ] Complete Gate CRUD (using sourceNodeId)
- [ ] Evidence Requirements configurable
- [ ] Cross-Flow Dependency CRUD (Add, List, Delete)
- [ ] Fan-Out Rule CRUD (Add, List, Delete)
- [ ] Validate endpoint returns all errors (including cross-flow and fan-out validation)
- [ ] Publish endpoint works on Validated only
- [ ] Version management endpoints work
- [ ] All routes have `force-dynamic`
- [ ] **Tenant Isolation:** All routes reject requests where actor's `companyId` ≠ resource's `companyId`
- [ ] **Tenant Isolation:** List endpoints return only resources matching actor's `companyId`
- [ ] **Tenant Isolation:** Create endpoints assign actor's `companyId` to new resources

---

### EPIC-09: Permissions Enforcement

**Priority:** P1  
**Dependencies:** EPIC-04  
**Canon Source:** `docs/canon/permissions/`

#### Objectives

Implement capability-based permission system for cost data visibility.

#### Implementation Status

**PARTIALLY COMPLETE** - Core implementation exists at `src/lib/auth/capabilities.ts`

#### Remaining Steps

1. **Verify Implementation**
   - `hasCapability(ctx, capability)` follows evaluation order
   - `omitCostFields(data, ctx)` recursively nulls fields
   - `buildAuthorityContext(member)` builds context correctly

2. **Integration**
   - Apply `omitCostFields` to all API routes returning cost data
   - Ensure CompanyMember has capabilities JSON field

3. **Testing**
   - Verify deny always wins
   - Verify unknown capabilities return false
   - Verify response shape stability

#### Acceptance Criteria

- [ ] `hasCapability` respects evaluation order
- [ ] Deny wins over allow
- [ ] Unknown capabilities return false
- [ ] `omitCostFields` nulls cost fields, preserves shape
- [ ] Recursion works on nested objects/arrays
- [ ] Non-cost fields unaffected
- [ ] Single source of truth for COST_CLASS_FIELDS

---

### Phase 4: User Interface

---

### EPIC-08: Work Station Integration

**Priority:** P1  
**Dependencies:** EPIC-05, EPIC-07  
**Canon Source:** `docs/canon/workstation/`

#### Authorization Requirement

> **Tenant Isolation:** Work Station queries for Actionable Tasks are scoped to the actor's `companyId`. All submission endpoints (Evidence attachment, Outcome recording) require that the actor's `companyId` matches the Flow's `companyId`. The API layer validates this before invoking FlowSpec. Within a tenant, all members see all Actionable Tasks—there is no per-user task filtering in v2.

#### Objectives

Implement the human execution surface for performing Tasks.

#### Implementation Steps

1. **Work Station Page**
   ```
   src/app/(app)/workstation/
   ├── page.tsx              # Task list view
   ├── components/
   │   ├── TaskList.tsx
   │   ├── TaskCard.tsx
   │   ├── TaskDetail.tsx
   │   ├── EvidenceUpload.tsx
   │   └── OutcomeSelector.tsx
   └── hooks/
       ├── useActionableTasks.ts
       └── useTaskSubmission.ts
   ```

2. **API Integration**
   - Query FlowSpec for Actionable Tasks
   - Display Tasks from multiple Flows in FlowGroup
   - Submit Evidence and Outcomes to FlowSpec

3. **Key Behaviors**
   - Only display Actionable Tasks
   - Preserve Evidence on submission failure
   - Refresh after successful submission
   - Handle stale state gracefully
   - Show informative error messages

4. **domainHint Usage**
   - Visual grouping only
   - MUST NOT affect Actionability or filtering

#### Key Invariants

| ID | Invariant | Implementation |
|----|-----------|----------------|
| WS-INV-001 | Not a Workflow Engine | No execution logic |
| WS-INV-002 | Actionability from FlowSpec | Query, don't compute |
| WS-INV-003 | Outcomes Submitted | No local recording |
| WS-INV-010 | No Outcome Inference | Explicit selection only |

#### Acceptance Criteria

- [ ] Queries FlowSpec for Actionable Tasks
- [ ] Only displays Actionable Tasks
- [ ] Tasks from multiple Flows displayed together
- [ ] Evidence can be uploaded
- [ ] Evidence submitted to FlowSpec
- [ ] Outcomes selected from allowed list
- [ ] Outcomes submitted to FlowSpec
- [ ] Stale state handled gracefully
- [ ] Evidence preserved on failure
- [ ] Task list refreshes after submission
- [ ] Authentication required
- [ ] **Tenant Isolation:** Actionable Task queries return only tasks from actor's `companyId`
- [ ] **Tenant Isolation:** Submissions rejected where actor's `companyId` ≠ Flow's `companyId`

---

## 5. Implementation Sequence

### 5.1 Recommended Order

| Order | Epic | Description | Blocking |
|-------|------|-------------|----------|
| 1 | EPIC-01 | Engine Core | All others |
| 2 | EPIC-02 | Validation | EPIC-04 |
| 3 | EPIC-06 | Evidence | EPIC-04 |
| 4 | EPIC-04 | Lifecycle | EPIC-03, EPIC-05, EPIC-07 |
| 5 | EPIC-03 | Flow Instantiation | EPIC-05, EPIC-08 |
| 6 | EPIC-07 | Builder API | EPIC-08 |
| 7 | EPIC-05 | Cross-Flow | EPIC-08 |
| 8 | EPIC-09 | Permissions | None (parallel) |
| 9 | EPIC-08 | Work Station | End |

### 5.2 Parallel Opportunities

After EPIC-01:
- EPIC-02 and EPIC-06 can run in parallel

After EPIC-04:
- EPIC-07 and EPIC-09 can run in parallel
- EPIC-03 can start immediately

After EPIC-03:
- EPIC-05 can start

---

## 6. Testing Strategy

### 6.1 Unit Tests

Each module requires unit tests covering:
- Happy path
- Edge cases from epic documentation
- Invariant enforcement

### 6.2 Integration Tests

- Flow lifecycle: Draft → Published → Flow creation → Execution
- Cross-flow dependencies: Finance → Execution coordination
- Evidence requirements enforcement
- Permission data shaping
- **Tenant isolation:** Verify cross-tenant requests are rejected at all enforcement points (Builder API, Lifecycle, Flow Instantiation, Work Station)

### 6.3 E2E Tests

- Builder: Create and publish workflow
- Work Station: Complete task with evidence
- Multi-flow: Parallel flow coordination

---

## 7. Risk Mitigation

### 7.1 Architectural Risks

| Risk | Mitigation |
|------|------------|
| Work Station computes Actionability | Review all Work Station code for engine logic |
| Domain-to-domain coupling | Audit API calls between modules |
| Outcome mutation | Database triggers or application guards |
| Published workflow modification | Immutable version snapshots |
| **Tenant isolation bypass** | All API routes must validate `companyId` match before processing; integration tests must verify cross-tenant requests are rejected |
| **Authentication assumed as authorization** | Code review checklist must verify tenant ownership check exists at each enforcement point (see §1.3.2) |

### 7.2 Performance Risks

| Risk | Mitigation |
|------|------------|
| Actionability computation slow | Cache derived state, invalidate on Truth change |
| Large workflow validation | Paginate validation, background processing |
| Evidence upload size | Stream uploads, size limits |

---

## 8. Success Metrics

### 8.1 Functional Completeness

- [ ] All 9 epics implemented
- [ ] All acceptance criteria met
- [ ] All invariants enforced
- [ ] **Tenant isolation enforced at all surfaces** (see §1.3.2)

### 8.2 Quality Gates

- [ ] Unit test coverage > 80%
- [ ] Zero critical bugs
- [ ] API response times < 500ms (p95)

---

## 9. Appendix: Key Canon References

| Document | Purpose |
|----------|---------|
| `00_flowspec_glossary.md` | Term definitions |
| `10_flowspec_engine_contract.md` | Engine behavior contract |
| `20_flowspec_invariants.md` | Invariants that must always hold |
| `30_flowspec_examples.md` | Reference workflow patterns |
| `40_flowspec_builder_contract.md` | Builder behavior contract |
| `50_flowspec_builder_ui_api_map.md` | API specifications |
| `10_workstation_contract.md` | Work Station behavior contract |
| `20_workstation_invariants.md` | Work Station invariants |
| `10_permissions_contract.md` | Permission system contract |

---

## 10. Drift Protection Workstream

### 10.1 Purpose

Prevent implementation drift from canonical requirements through automated CI guards that enforce structural constraints at the schema, route, and import boundary levels. Guards run on every PR and block merges when violations are detected.

### 10.2 P0 Guards (Approved)

| Guard | Purpose |
|-------|---------|
| `guard_flowspec_schema_constraints.mjs` | Enforce Truth immutability and forbid derived-state-as-truth in Prisma schema |
| `guard_flowspec_forbidden_routes.mjs` | Block API routes that would violate invariants (Outcome mutation, Evidence deletion, Published modification) |
| `guard_flowspec_truth_mutation_boundary.mjs` | Ensure only FlowSpec modules can import and invoke Truth mutation functions |
| `guard_flowspec_route_tenant_check.mjs` | Verify all FlowSpec API routes call tenant validation before processing |
| `guard_flowspec_workstation_boundary.mjs` | Prevent Work Station from importing FlowSpec engine internals |

### 10.3 Guard Milestones

| Milestone | Guards | Lands Before | Rationale |
|-----------|--------|--------------|-----------|
| **M0** | `guard_flowspec_schema_constraints.mjs`, `guard_flowspec_truth_mutation_boundary.mjs` | EPIC-01 start | Establish Truth boundaries before any engine code |
| **M1** | `guard_flowspec_forbidden_routes.mjs`, `guard_flowspec_route_tenant_check.mjs` | EPIC-07 start | Lock route invariants before Builder API |
| **M3** | `guard_flowspec_workstation_boundary.mjs` | EPIC-08 start | Lock Work Station boundary before UI integration |

### 10.4 CI Tiering

| Stage | Guards Run | Blocking |
|-------|------------|----------|
| **PR** | All P0 guards | Yes — PR cannot merge if any guard fails |
| **Merge** | All P0 guards (redundant verification) | Yes |
| **Nightly** | P0 guards + promoted P1 guards | Alert only |

### 10.5 Guard Failure Policy

When a P0 guard fails:

1. **Default action:** Align code to satisfy the guard (fix the violation).
2. **If guard is wrong:** Open a canon update PR that documents why the constraint should change, update the guard, then re-run.
3. **No silent bypass:** Merging with a failing guard requires explicit code owner approval AND a linked issue explaining the exception.

> **Rule:** Code must conform to canon. If code cannot conform, canon must be explicitly updated first. Silent divergence is forbidden.

### 10.6 Schema Drift Constraints (Enforced by `guard_flowspec_schema_constraints.mjs`)

| Constraint | Tables Affected | Invariant Protected |
|------------|-----------------|---------------------|
| No `@updatedAt` on Truth tables | TaskExecution, NodeActivation, EvidenceAttachment | INV-007 (Outcome Immutability) |
| No `onDelete: Cascade` on Truth FKs | TaskExecution, NodeActivation, EvidenceAttachment | Audit trail preservation |
| `FlowStatus` includes `BLOCKED` | Flow | INV-023 (Fan-Out Failure Behavior) |
| No `targetVersion` on FanOutRule | FanOutRule | §10.3.1 (No version pinning in v2) |
| No `retriedAt`/`retryCount` on FanOutFailure | FanOutFailure | §10.3.2 (No retry in v2) |
| No `actionable` column on Task models | Task, TaskExecution | INV-006 (Derived State not stored) |

---

**End of Document**
