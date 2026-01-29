# FlowSpec Engine Contract

**Document ID:** 10_flowspec_engine_contract  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)
- [20_flowspec_invariants.md](./20_flowspec_invariants.md)
- [30_flowspec_examples.md](./30_flowspec_examples.md)

---

## 1. Purpose

This document defines the behavioral contract of the FlowSpec execution engine. It specifies:
- What FlowSpec does
- What FlowSpec does NOT do
- How execution semantics work
- The Workflow lifecycle

**Rule:** All FlowSpec implementations MUST conform to this contract.

---

## 2. Core Statement

**FlowSpec IS the execution engine.**

FlowSpec defines AND executes workflows. There is no separate workflow runner, orchestrator, or engine. FlowSpec is not a configuration format consumed by another system.

---

## 2.1 Foundational Boundary (Non-Negotiable)

> **FlowSpec is the sole engine responsible for defining and executing workflows. The Work Station does not execute workflows; it exists solely to perform and submit human work (tasks) into FlowSpec.**

This statement is the canonical lock. All other documentation, design decisions, and implementations MUST align with this boundary. No domain—including Work Station, Sales, Finance, or Admin—may assume workflow execution responsibility.

---

## 3. Non-Goals (Explicit Exclusions)

FlowSpec does NOT:

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Manage user identity or authentication | Auth exists externally (Clerk). FlowSpec requires authenticated session; it does not provide one. |
| 3.2 | Define permissions or role hierarchies | Authorization beyond "requires authenticated user" is out-of-scope for the engine. |
| 3.3 | Provide UI components | FlowSpec is an engine. The Builder is a separate product surface that consumes FlowSpec. |
| 3.4 | Store business data unrelated to execution | FlowSpec stores execution Truth (Outcomes, Evidence, routing). Domain data belongs to domain systems. |
| 3.5 | Implement domain logic for Sales, Finance, Admin, or Work Station | These are external consumers. FlowSpec exposes integration surfaces; it does not contain their logic. |
| 3.6 | Schedule or time-trigger executions | FlowSpec executes when invoked. Scheduling is an external concern. |
| 3.7 | Send notifications or alerts | Observability hooks exist; notification dispatch is external. |
| 3.8 | Manage UI theming | Theming is a UI/Builder concern, not an engine concern. |

---

## 4. Core Conceptual Model

This section describes the conceptual execution model. It is intentionally free of database schemas or code.

### 4.1 Execution Hierarchy

```
Flow (Instance)
└── bound to → Workflow (Specification)
    └── contains → Node[]
        └── contains → Task[]
            └── defines → Outcome[] (allowed)
            └── defines → Evidence Requirements (optional)
            └── connected via → Gate[] (routing)
```

### 4.2 Execution Flow (Conceptual)

1. A **Flow** is created from a **Published Workflow**.
2. The Flow begins with the Workflow's designated **Entry Node(s)**.
3. Tasks within active Nodes become **Actionable**.
4. Work is performed on Tasks. **Evidence** is attached if required.
5. An **Outcome** is recorded on a Task, marking it done.
6. **Gates** evaluate the Outcome and determine next Node(s) to activate.
7. Steps 3-6 repeat until the Workflow's **Terminal Condition** is met.
8. The Flow is complete.

### 4.3 Graph Structure

- Workflows are **directed graphs**, not linear pipelines.
- **Cycles are allowed.** Loops back to previous Nodes are valid (e.g., remediation loops).
- Multiple paths may be active concurrently (fan-out).
- Multiple paths may converge (fan-in, with defined join semantics).

---

## 5. Execution Semantics

### 5.1 Task Semantics

#### 5.1.1 Task Started

**Definition:** A Task is "started" when work has begun on it.

**Rules:**
1. A Task can only be started if it is Actionable.
2. A Task is Actionable when its containing Node is active AND the Task has no recorded Outcome.
3. Starting a Task is recorded in Truth.
4. A Task may only be started once per Flow execution (no re-starting without explicit loop routing).

#### 5.1.2 Task Done

**Definition:** A Task is "done" when an Outcome has been recorded.

**Rules:**
1. An Outcome MUST be one of the Task's defined allowed Outcomes.
2. Recording an Outcome is immutable — it cannot be changed.
3. Evidence requirements (if any) MUST be satisfied before an Outcome can be recorded.
4. Recording an Outcome triggers Gate evaluation.

---

### 5.2 Node Semantics

#### 5.2.1 Node Activation (Truth Event)

**Definition:** A Node becomes "active" when it is routed to by a Gate or is designated as an Entry Node at Flow start.

**NodeActivated Event (CANONICAL Truth Shape):**
```
{
  flowId: string,      // The Flow instance
  nodeId: string,      // The Node being activated
  activatedAt: string  // ISO 8601 timestamp
}
```

**Rules:**
1. A NodeActivated event MUST be recorded in Truth when:
   - A Flow is created and Entry Node(s) are activated, OR
   - A Gate routes to a Node (including re-activation in cycles)
2. NodeActivated events are Truth — they are persisted and immutable.
3. The set of "currently active Nodes" is Derived State computed from NodeActivated events + flow completion status.

#### 5.2.2 Node Started (Derived State)

**Definition:** A Node is "started" when at least one of its Tasks has been started.

**Rules:**
1. A Node is "started" (derived) when its first Task is started.
2. Node "started" is Derived State, computed from Task start timestamps.
3. Node "started" is distinct from Node "active" — a Node may be active (routed to) but not yet started (no Task work begun).

#### 5.2.3 Node Done

**Definition:** A Node is "done" when its completion rule is satisfied.

**Completion Rules (per-Node configuration):**

| Rule | Semantics |
|------|-----------|
| `ALL_TASKS_DONE` | Node is done when ALL Tasks in the Node have recorded Outcomes. |
| `ANY_TASK_DONE` | Node is done when ANY Task in the Node has recorded an Outcome. |
| `SPECIFIC_TASKS_DONE` | Node is done when a specified subset of Tasks have recorded Outcomes. |

**Rules:**
1. Node completion rule is defined in the Workflow specification.
2. Default rule (if unspecified): `ALL_TASKS_DONE`.
3. Node "done" is Derived State computed from Task Outcomes (Truth).

---

### 5.3 Evidence Semantics

#### 5.3.1 Evidence Attachment

**Definition:** Evidence is data attached to a specific Task to support or justify an Outcome.

**Rules:**
1. Evidence is always attached to exactly one Task.
2. Evidence attachment is recorded in Truth.
3. Evidence cannot be detached or deleted once attached (append-only).
4. Evidence type and schema are defined in the Task's Evidence Requirements.

#### 5.3.2 Evidence Requirements

**Definition:** Evidence Requirements specify what Evidence MUST be attached to a Task before an Outcome can be recorded.

**Rules:**
1. Evidence Requirements are optional per-Task.
2. If Evidence Requirements exist, they MUST be satisfied before any Outcome is recorded.
3. Attempting to record an Outcome without satisfying Evidence Requirements MUST fail.
4. Evidence Requirements are evaluated at Outcome recording time.

#### 5.3.3 Evidence Schema Contract (CANONICAL)

**Definition:** The Evidence Schema defines the type and constraints for required Evidence. This section is the authoritative contract for Evidence Schema structure.

**Evidence Types (Enumerated):**

| Type | Description | Use Case |
|------|-------------|----------|
| `file` | Uploaded file with optional MIME type and size constraints | Photos, documents, PDFs |
| `text` | Free-form text with optional length constraints | Notes, descriptions, justifications |
| `structured` | JSON data conforming to a JSON Schema | Form data, structured records |

**Schema Shape (Canonical JSON Structure):**

All Evidence Schemas MUST have a `type` field. Additional fields depend on the type:

**File Schema:**
```json
{
  "type": "file",
  "mimeTypes": ["image/jpeg", "image/png", "application/pdf"],
  "maxSize": 10485760,
  "description": "Upload photo documentation"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"file"` | YES | Evidence type discriminator |
| `mimeTypes` | `string[]` | NO | Allowed MIME types; if omitted, any file type accepted |
| `maxSize` | `number` | NO | Maximum file size in bytes; if omitted, no limit enforced |
| `description` | `string` | NO | Human-readable description |

**Text Schema:**
```json
{
  "type": "text",
  "minLength": 10,
  "maxLength": 500,
  "description": "Explain the reason for this decision"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"text"` | YES | Evidence type discriminator |
| `minLength` | `number` | NO | Minimum text length; if omitted, no minimum |
| `maxLength` | `number` | NO | Maximum text length; if omitted, no maximum |
| `description` | `string` | NO | Human-readable description |

**Structured Schema:**
```json
{
  "type": "structured",
  "jsonSchema": { "type": "object", "properties": { ... } },
  "description": "Fill out the inspection checklist"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"structured"` | YES | Evidence type discriminator |
| `jsonSchema` | `object` | NO | JSON Schema object for structured data validation |
| `description` | `string` | NO | Human-readable description |

**Schema Validation Rules:**

1. Schema MUST have a `type` field with value `"file"`, `"text"`, or `"structured"`.
2. Schema with unrecognized `type` value is INVALID.
3. If `evidenceRequired` is `true`, `evidenceSchema` MUST be non-null and valid (see INV-025).
4. Empty object `{}` is INVALID (missing required `type` field).
5. Type-specific fields are validated only if present (all are optional).

---

### 5.4 Outcome Semantics

#### 5.4.1 Explicit Outcomes Only

**Rules:**
1. Every Task MUST define its allowed Outcomes explicitly in the Workflow specification.
2. Outcomes are enumerated — no freeform or inferred Outcomes.
3. An Outcome recorded on a Task MUST be one of its allowed Outcomes.
4. Attempting to record an undefined Outcome MUST fail.

#### 5.4.2 Outcome Recording

**Rules:**
1. An Outcome can only be recorded on a started Task.
2. An Outcome can only be recorded once per Task (immutable).
3. Recording an Outcome marks the Task as done.
4. Recording an Outcome triggers Gate evaluation for routing.

#### 5.4.3 Outcome Immutability

**Rule:** Once recorded, an Outcome cannot be changed, overwritten, or deleted.

**Rationale:** Outcomes are Truth. Mutating Truth would invalidate the audit trail and derived state consistency.

---

### 5.5 Gate Semantics

#### 5.5.1 Gate Purpose

**Definition:** Gates route execution to the next Node(s) based on Outcomes.

**Rules:**
1. Gates evaluate Outcomes. Gates do NOT evaluate state, progress, or time.
2. Gates do NOT decide completion. Gates decide routing.
3. Gates are evaluated when an Outcome is recorded on a Task.

#### 5.5.2 Gate Routing Rules

**Rules:**
1. A Gate MUST define a route for every Outcome it evaluates.
2. No Outcome may be orphaned (no route defined).
3. A Gate MAY route to zero Nodes (terminal path).
4. A Gate MAY route to one Node (linear progression).
5. A Gate MAY route to multiple Nodes (fan-out).
6. A Gate MAY route to a previously visited Node (cycle/loop).

#### 5.5.2.1 Gate Key Semantics (CANONICAL)

**Rule:** Gates are keyed by `(nodeId, outcomeName)` — routing operates at the Node level.

**Constraints:**
1. Within a single Node, Tasks MUST NOT define conflicting routing intent for the same outcome name.
2. If multiple Tasks in a Node share an outcome name (e.g., `APPROVED`), all routes for that outcome name MUST resolve to the same target Node(s).
3. The Builder MUST enforce this constraint at validation time.
4. Builder API routes use `sourceNodeId` — this is canonical and MUST NOT change to `sourceTaskId`.

**Rationale:**
- Routing at Node-level maintains graph simplicity.
- Task-level routing would fragment graph comprehension and create combinatorial complexity.
- Outcome names are scoped to the Node for routing purposes.

**Validation Error:** "Conflicting routes for outcome '{outcomeName}' in Node '{nodeId}': Tasks define different target Nodes."

#### 5.5.3 Gate Evaluation

**Process:**
1. Task records Outcome.
2. Gate(s) associated with that Task's Node evaluate the Outcome.
3. Gate determines target Node(s) based on Outcome value.
4. Target Node(s) are activated.
5. Tasks in newly activated Nodes become Actionable.

---

## 6. Loop and Cycle Policy

### 6.1 Cycles Allowed

**Rule:** Workflows MAY contain cycles (loops back to previous Nodes).

**Rationale:** Real-world processes include remediation loops, approval cycles, and retry patterns. Forbidding cycles would artificially constrain expressiveness.

### 6.2 Cycle Semantics

**Rules:**
1. When a Gate routes to a previously visited Node, that Node is re-activated.
2. Tasks in the re-activated Node become Actionable again.
3. Task state from prior visits is preserved in Truth (audit trail).
4. New Outcomes are recorded as new entries, not overwrites.

### 6.3 Infinite Loop Prevention

**Rules:**
1. Infinite loops are a Workflow design problem, not an engine problem.
2. The Builder SHOULD warn about potential infinite loops during validation.
3. The engine MAY implement a configurable execution step limit as a safety measure.
4. If a step limit is exceeded, the Flow is suspended (not terminated) with an error state.

---

## 7. Workflow Lifecycle

### 7.1 Lifecycle States

| State | Editable | Executable | Description |
|-------|----------|------------|-------------|
| Draft | Yes | No | Work in progress. May be incomplete or invalid. |
| Validated | No* | No | Passed all validation. Ready to publish. |
| Published | No | Yes | Immutable. Flows can be created. |

*Validated can revert to Draft for edits.

### 7.2 State Transitions

```
Draft → Validated (via Validate action)
Validated → Draft (via Edit action — reverts for changes; UI: "Return to Draft")
Validated → Published (via Publish action)
Published → (terminal, no transitions out)
```

### 7.3 Versioning

**Rules:**
1. Each Published Workflow has a unique version identifier.
2. Publishing creates a new version; it does NOT mutate the previous version.
3. Existing Flows continue executing against their bound Workflow version.
4. New Flows may be created against any Published version (unless deprecated).
5. Version deprecation is a policy concern, not an engine concern.

---

## 8. Validation Checklist

Before a Workflow can transition from Draft to Validated, ALL of the following MUST pass:

### 8.1 Structural Validation

| # | Check | Failure Condition |
|---|-------|-------------------|
| 8.1.1 | Entry Node exists | No Node marked as entry point |
| 8.1.2 | All Nodes reachable | Node exists that cannot be reached from Entry Node(s) |
| 8.1.3 | No orphan Tasks | Task exists in no Node |
| 8.1.4 | Terminal path exists | No path leads to terminal (unless Workflow is intentionally non-terminating) |

### 8.2 Outcome/Gate Validation

| # | Check | Failure Condition |
|---|-------|-------------------|
| 8.2.1 | All Tasks have Outcomes | Task exists with zero defined Outcomes |
| 8.2.2 | All Outcomes have routes | Outcome exists with no Gate route defined |
| 8.2.3 | No orphaned Outcomes | Outcome defined but never routed |
| 8.2.4 | Gate targets exist | Gate references Node that does not exist |

### 8.3 Evidence Validation

| # | Check | Failure Condition |
|---|-------|-------------------|
| 8.3.1 | Evidence schemas well-formed | Evidence Requirement references undefined type |
| 8.3.2 | Required Evidence achievable | Task requires Evidence but no mechanism to provide it |

### 8.4 Semantic Validation

| # | Check | Failure Condition |
|---|-------|-------------------|
| 8.4.1 | Node completion rules valid | Node specifies `SPECIFIC_TASKS_DONE` but references non-existent Task |
| 8.4.2 | Cycle acknowledgment (if required) | Workflow contains cycles but designer has not acknowledged |

---

## 9. Integration Surface (Conceptual)

FlowSpec exposes the following conceptual integration surfaces to external domains:

### 9.1 Query Surfaces (Read-Only)

| Surface | Purpose | Consumers |
|---------|---------|-----------|
| Actionable Tasks | "What can be worked on now?" | Work Station |
| Flow State | "What is the current derived state of a Flow?" | All domains |
| Evidence Attached | "What Evidence exists on a Task?" | Audit, Reporting |

### 9.2 Mutation Surfaces (Write)

| Surface | Purpose | Consumers |
|---------|---------|-----------|
| Record Outcome | Submit an Outcome for a Task | Work Station |
| Attach Evidence | Attach Evidence to a Task | Work Station |
| Create Flow | Instantiate a new Flow from a Workflow | Domain initiators |

### 9.3 Boundary Rules

1. Only FlowSpec may mutate execution Truth.
2. External domains MUST NOT directly modify Flow state, Outcomes, or Evidence.
3. External domains interact ONLY through defined integration surfaces.
4. External domains MAY cache Derived State but MUST treat FlowSpec as authoritative.

---

## 10. Parallel Flows and Flow Groups

### 10.1 Parallel Flows

**Definition:** Multiple Flows may execute concurrently for the same unit of work. These Flows are bound together via a Flow Group.

**Rules:**
1. A Flow Group is created when the first Flow for a unit of work is instantiated.
2. Additional Flows may be added to an existing Flow Group.
3. Flows within a Flow Group may be instantiated from different Workflows.
4. Each Flow executes independently according to its own Workflow graph.
5. Cross-Flow Dependencies (see §11) create actionability relationships between Flows.

### 10.2 Flow Group Semantics

**Rules:**
1. A Flow Group has a unique identifier.
2. All Flows in a Flow Group share the same Flow Group identifier.
3. Cross-Flow Dependencies are evaluated within Flow Group scope only.
4. A Flow Group is complete when all its Flows are complete.

### 10.3 Fan-Out Patterns

**Definition:** Fan-out occurs when a single Outcome triggers the creation or activation of multiple Flows.

**Example Pattern:**
1. Sales Flow reaches terminal Outcome `DEPOSIT_COLLECTED`.
2. Gate routes to terminal (Sales Flow complete).
3. Flow Group rules (authored in Builder) specify: on `DEPOSIT_COLLECTED`, instantiate Finance Flow and Execution Flow.
4. Both Flows start; their Entry Node Tasks become Actionable per their own constraints.

**Rule:** Fan-out is defined in the Builder. No domain "triggers" another. FlowSpec evaluates rules and instantiates Flows.

#### 10.3.1 Fan-Out Target Version Resolution (CANONICAL)

**Rule:** Fan-out MUST resolve target Workflow to the **Latest Published** version at evaluation time.

**Constraints:**
1. When a fan-out rule triggers, the Engine MUST instantiate Flows from the Latest Published version of each target Workflow.
2. Version pinning (specifying an exact version in fan-out rules) is NOT supported in v1.
3. If no Published version exists for a target Workflow, fan-out for that target MUST fail (logged as error).
4. Fan-out version resolution is evaluated at the moment the triggering Outcome is recorded.

**Rationale:**
- Latest Published ensures new Flows benefit from workflow improvements.
- Version pinning adds complexity and versioning entanglement not required for v1.
- Explicit "no version pinning" prevents scope creep.

#### 10.3.2 Fan-Out Failure Behavior (CANONICAL)

**Rule:** Fan-out is an integral part of Outcome recording. If fan-out fails, the triggering Flow is BLOCKED.

**v2 Semantics:**
1. Fan-out instantiation is attempted as part of Outcome recording.
2. If fan-out succeeds, the Outcome is recorded and the triggering Flow proceeds.
3. If fan-out fails, the Outcome is still recorded (Truth is preserved), but the triggering Flow enters a BLOCKED state.
4. Fan-out failure MUST be logged as a system event with sufficient context (triggering Flow, Outcome, target Workflow, error reason).
5. The BLOCKED state is visible and terminal for v2 — no automatic retry, no manual retry surface.

**Rationale:**
- Fan-out represents a required downstream action. Proceeding without it creates orphaned coordination.
- The Outcome is Truth and remains recorded (not rolled back), but the Flow cannot progress until the failure is resolved outside the system.
- Retry mechanisms are explicitly deferred from v2 to avoid complexity.

**v2 Explicit Deferral:**
- Automatic retry of failed fan-outs: DEFERRED
- Manual retry surface (UI/API): DEFERRED
- Background retry jobs: DEFERRED

---

## 11. Cross-Flow Gating (Actionability Dependencies)

### 11.1 Purpose

Cross-Flow Gating allows Tasks in one Flow to wait for Outcomes in another Flow before becoming Actionable. This enables complex coordination patterns without coupling domains.

### 11.2 Cross-Flow Dependency Definition

**A Cross-Flow Dependency is:**
- A user-authored rule in the Workflow specification
- Created in the FlowSpec Builder
- Evaluated by FlowSpec at Actionability computation time
- Scoped to a Flow Group

**A Cross-Flow Dependency is NOT:**
- A trigger mechanism
- A domain-to-domain communication channel
- Computed or inferred by external domains

### 11.3 Cross-Flow Dependency Rules

**Rules:**
1. Cross-Flow Dependencies are defined per-Task in the Workflow specification.
2. A Task with a Cross-Flow Dependency is NOT Actionable until the dependency is satisfied.
3. FlowSpec evaluates Cross-Flow Dependencies as part of Derived State computation.
4. The dependency specifies: source Workflow, source Task, required Outcome.
5. At evaluation time, FlowSpec checks if any Flow in the Flow Group (of the specified Workflow type) has recorded the required Outcome.
6. If satisfied, the constraint passes. Combined with other constraints (Node activation), the Task may become Actionable.

### 11.4 Example: Finance Gates Execution

**Scenario (Illustrative):**
- Execution Flow Task "Schedule Installation" has Cross-Flow Dependency:
  - Source: Finance Workflow
  - Task: "Collect Deposit"
  - Required Outcome: `DEPOSIT_COLLECTED`
- Execution Flow is started (Flow exists).
- "Schedule Installation" Node is Entry Node (active).
- BUT Task is NOT Actionable because Cross-Flow Dependency is unsatisfied.
- Finance Flow records `DEPOSIT_COLLECTED`.
- FlowSpec re-evaluates Derived State.
- "Schedule Installation" becomes Actionable.

**Key Point:** Execution did not "wait" for Finance to "signal" it. FlowSpec evaluated a constraint. No domain-to-domain communication occurred.

### 11.5 Validation for Cross-Flow Dependencies

**Builder Validation Rules:**
1. Source Workflow must exist and be Published (or reference same-version draft).
2. Source Task must exist in Source Workflow.
3. Required Outcome must be a defined Outcome on Source Task.
4. Circular cross-flow dependencies are flagged as warnings (may cause deadlock).

---

## 12. Determinism Guarantee

**Rule:** Given identical Truth, FlowSpec MUST produce identical Derived State.

**Implications:**
1. No randomness in Gate evaluation.
2. No time-dependent routing (unless time is recorded as Truth).
3. No external state influencing routing decisions.
4. Derived State is reproducible and auditable.

---

**End of Document**
