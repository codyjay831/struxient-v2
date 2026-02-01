# FlowSpec Invariants

**Document ID:** 20_flowspec_invariants  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [25_flowspec_breaking_changes.md](./25_flowspec_breaking_changes.md)

---

## 1. Purpose

This document enumerates the invariants of the FlowSpec system. An invariant is a rule that MUST always hold true. Violation of any invariant indicates a bug, misconfiguration, or design flaw.

**Structure:** Each invariant includes:
- MUST / MUST NOT statement
- Rationale
- Violation example
- Detection idea (conceptual)

---

## 2. Invariants

---

### INV-001: No Work Outside Tasks

**Statement:**  
Work MUST only be executed within Tasks. No execution may occur at the Workflow, Flow, Node, or Gate level.

**Rationale:**  
Tasks are the atomic unit of work. Allowing work elsewhere fragments execution tracking, breaks auditability, and violates the single-responsibility principle of the execution hierarchy.

**Violation Example:**  
A Node is configured to "send an email when activated" without defining a Task for sending the email.

**Detection Idea:**  
Audit all side-effects in the system. If any side-effect is not traceable to a Task Outcome, the invariant is violated.

---

### INV-002: Explicit Outcomes Only

**Statement:**  
Task Outcomes MUST be explicitly defined and enumerated. Outcomes MUST NOT be inferred, computed, or dynamically generated.

**Rationale:**  
Explicit enumeration ensures predictability, enables complete Gate routing, and prevents undefined behavior.

**Violation Example:**  
A Task accepts freeform Outcome strings from user input, resulting in an Outcome "Looks good to me!" that has no defined Gate route.

**Detection Idea:**  
Compare all recorded Outcomes against the Task's defined allowed Outcomes. Any mismatch indicates a violation or a bug in the recording mechanism.

---

### INV-003: Gates Route, Not Decide Completion

**Statement:**  
Gates MUST only route to the next Node(s). Gates MUST NOT determine whether a Task or Node is complete.

**Rationale:**  
Completion is a function of Outcomes recorded (Truth). Routing is a function of evaluating Outcomes (Derived logic). Conflating these responsibilities creates ambiguity about what "done" means.

**Violation Example:**  
A Gate is configured to "mark the Node as complete if all Tasks pass" instead of simply routing based on individual Task Outcomes.

**Detection Idea:**  
Review Gate definitions. If any Gate contains logic referencing "completion", "done", or "finished" states rather than Outcome values, the invariant is violated.

---

### INV-004: No Stage-Implied Readiness

**Statement:**  
A Task MUST NOT become Actionable solely because it is in a later "stage" or has a higher sequence number. Actionability MUST be determined only by Gate routing and Node activation.

**Rationale:**  
Stage-implied readiness introduces implicit ordering that is not expressed in the graph. This breaks the graph-first execution model and creates hidden dependencies.

**Violation Example:**  
Tasks are numbered 1-5, and Task 3 automatically becomes Actionable when Task 2 is done, even though no Gate explicitly routes to Task 3's Node.

**Detection Idea:**  
Trace every Task activation back to a Gate routing decision or Entry Node designation. If a Task becomes Actionable without such a trace, the invariant is violated.

---

### INV-005: No Floating Evidence

**Statement:**  
Evidence MUST always be attached to exactly one Task. Evidence MUST NOT exist at the Flow, Node, or Workflow level unattached.

**Rationale:**  
Unattached Evidence has no context, cannot be validated against requirements, and breaks the audit trail.

**Violation Example:**  
A document is uploaded to a Flow for "general reference" without being attached to any specific Task.

**Detection Idea:**  
Query all Evidence records. Each MUST have a non-null Task reference. Any Evidence without a Task reference violates the invariant.

---

### INV-006: Determinism (Same Truth → Same Derived State)

**Statement:**  
Given identical Truth (recorded Outcomes, Evidence, timestamps), FlowSpec MUST produce identical Derived State. Derived State computation MUST be deterministic and reproducible.

**Rationale:**  
Non-determinism makes debugging impossible, breaks auditability, and causes inconsistent user experiences.

**Violation Example:**  
Two queries for "Actionable Tasks" on the same Flow with the same Truth return different results because one query was made during high server load.

**Detection Idea:**  
Implement snapshot comparison: capture Truth state, compute Derived State, replay from snapshot, compare. Any difference indicates non-determinism.

---

### INV-007: Outcome Immutability

**Statement:**  
Once an Outcome is recorded on a Task, it MUST NOT be modified, overwritten, or deleted.

**Rationale:**  
Outcomes are Truth. Mutating Truth invalidates all downstream Derived State, breaks the audit trail, and violates the integrity of Gate routing decisions that already occurred.

**Violation Example:**  
An admin "corrects" a Task Outcome from `REJECTED` to `APPROVED` after the Flow has already routed based on `REJECTED`.

**Detection Idea:**  
Implement write-once storage for Outcomes. Any UPDATE or DELETE operation on Outcome records triggers an alert/failure.

---

### INV-008: All Outcomes Must Have Routes

**Statement:**  
Every defined Outcome on every Task MUST have a corresponding Gate route. No orphaned Outcomes are permitted.

**Rationale:**  
An orphaned Outcome causes the Flow to become stuck — the Outcome is recorded but the engine has no instruction on what to do next.

**Violation Example:**  
Task "Review Document" defines Outcomes `APPROVED`, `REJECTED`, `NEEDS_REVISION`. The Gate only routes `APPROVED` and `REJECTED`, leaving `NEEDS_REVISION` orphaned.

**Detection Idea:**  
During validation, enumerate all Outcomes across all Tasks. For each, verify a Gate route exists. Missing routes fail validation.

---

### INV-009: Only FlowSpec Mutates Execution Truth

**Statement:**  
Execution Truth (Outcomes, Evidence, Task state) MUST only be mutated through FlowSpec's defined interfaces. External domains MUST NOT directly modify Truth.

**Rationale:**  
Direct modification bypasses validation, Gate evaluation, and audit logging. It creates inconsistent state and breaks the integrity of the execution model.

**Violation Example:**  
A Finance module directly updates the database to mark a Task as complete without going through FlowSpec's "Record Outcome" interface.

**Detection Idea:**  
Audit database write operations. All writes to Truth tables MUST originate from FlowSpec service layer. Any write from other services indicates a violation.

---

### INV-010: Flow Bound to Workflow Version

**Statement:**  
A Flow MUST be permanently bound to a specific Workflow version at creation time. The binding MUST NOT change during Flow execution.

**Rationale:**  
Changing the Workflow mid-execution creates undefined behavior — Tasks may disappear, Outcomes may become invalid, Gate routes may break.

**Violation Example:**  
A Workflow is updated to remove a Node while an active Flow has a Task in that Node marked as Actionable.

**Detection Idea:**  
Store Workflow version ID on Flow record at creation. Assert this value never changes. Alert if Workflow version reference is modified.

---

### INV-011: Published Workflows Are Immutable

**Statement:**  
A Workflow in Published state MUST NOT be modified. Any change requires creating a new version.

**Rationale:**  
Mutating a Published Workflow affects all Flows bound to that version, violating INV-010 by proxy and breaking audit integrity.

**Violation Example:**  
An admin "hot-fixes" a Gate route in a Published Workflow without creating a new version.

**Detection Idea:**  
Implement write protection on Published Workflow records. Any UPDATE operation triggers failure/alert.

---

### INV-012: Graph-First Execution

**Statement:**  
Execution order MUST be determined by the graph structure (Nodes, Gates, routing) as expressed in the Workflow. Execution order MUST NOT be implied by display order, creation order, or naming conventions.

**Rationale:**  
Implicit ordering creates hidden dependencies, makes the Workflow harder to understand, and breaks the principle that the graph IS the execution model.

**Violation Example:**  
Nodes named "Step 1", "Step 2", "Step 3" execute in numeric order regardless of Gate routing because the engine sorts by name.

**Detection Idea:**  
Test with deliberately misordered names. If execution follows naming rather than Gates, the invariant is violated.

---

### INV-013: No Inferred Task State

**Statement:**  
Task state (started, done, Actionable) MUST be determined only by recorded Truth (explicit start, recorded Outcome) and Derived State computation. Task state MUST NOT be inferred from absence of data.

**Rationale:**  
Inferring state from absence ("no Outcome recorded means in progress") is fragile and leads to incorrect assumptions when data is missing or delayed.

**Violation Example:**  
A Task is displayed as "In Progress" because no Outcome exists, even though the Task was never actually started.

**Detection Idea:**  
Audit Task state derivation logic. Ensure all states have explicit positive conditions rather than negative inference.

---

### INV-014: Entry Node(s) Must Exist

**Statement:**  
Every Workflow MUST designate at least one Entry Node. A Workflow with no Entry Node MUST NOT pass validation.

**Rationale:**  
Without an Entry Node, the Flow has nowhere to start. This is a structural error.

**Violation Example:**  
A Workflow is published with all Nodes requiring Gate routing from other Nodes, creating a chicken-and-egg problem.

**Detection Idea:**  
Validation check: assert at least one Node is flagged as Entry. Fail validation if none found.

---

### INV-015: Terminal Path Must Exist (or Explicit Non-Termination)

**Statement:**  
Every Workflow MUST have at least one path that leads to termination (no further routing), OR the Workflow MUST be explicitly marked as non-terminating.

**Rationale:**  
A Workflow with no terminal path runs forever, consuming resources and creating stuck Flows.

**Violation Example:**  
Every Gate routes to another Node indefinitely. No Outcome ever leads to Flow completion.

**Detection Idea:**  
Graph analysis: traverse all paths. If no path ends in a terminal (no outbound routes), and Workflow is not marked non-terminating, fail validation.

---

### INV-016: Evidence Requirements Evaluated at Outcome Recording

**Statement:**  
Evidence Requirements MUST be evaluated at the moment of Outcome recording. If requirements are not satisfied, Outcome recording MUST fail.

**Rationale:**  
Evaluating at any other time creates race conditions (Evidence added after Outcome) or false positives (Evidence later removed).

**Violation Example:**  
An Outcome is recorded, then Evidence is uploaded afterward. The system shows requirements as satisfied even though they weren't at recording time.

**Detection Idea:**  
Record Evidence state at Outcome recording time. If post-recording Evidence count differs from recorded count, flag for review.

---

### INV-017: Cross-Flow Dependencies Are User-Authored

**Statement:**  
Cross-Flow Dependencies MUST be explicitly authored by the user in the FlowSpec Builder. Cross-Flow Dependencies MUST NOT be inferred, auto-generated, or created by external domains.

**Rationale:**  
User-authored dependencies ensure visibility, auditability, and intentionality. Inferred dependencies create hidden coupling and unpredictable behavior.

**Violation Example:**  
The system automatically creates a dependency between Finance and Execution Flows because they share a customer ID, without the user defining this relationship.

**Detection Idea:**  
Audit all Cross-Flow Dependencies. Each must trace to a Builder action with user attribution. Dependencies without user attribution violate the invariant.

---

### INV-018: Domains Do Not Trigger Domains

**Statement:**  
No external domain (Sales, Finance, Work Station, Admin) MUST directly trigger, invoke, or activate another domain. All coordination MUST occur through FlowSpec constraint evaluation.

**Rationale:**  
Direct domain-to-domain triggering creates tight coupling, bypasses FlowSpec's single-source-of-truth for execution, and fragments the audit trail.

**Violation Example:**  
When Finance collects a deposit, the Finance module directly calls a Work Station API to "unlock" installation tasks, bypassing FlowSpec.

**Detection Idea:**  
Audit all inter-domain API calls. If domain A calls domain B directly for workflow-related state changes, the invariant is violated. All such changes must go through FlowSpec.

---

### INV-019: FlowSpec Evaluates All Actionability

**Statement:**  
FlowSpec MUST be the sole evaluator of Task Actionability. External domains MUST NOT compute, infer, or override Actionability.

**Rationale:**  
Distributed Actionability computation leads to inconsistent state, race conditions, and incorrect user experiences.

**Violation Example:**  
Work Station calculates that a Task "should" be Actionable based on its local cache and displays it to the user, even though FlowSpec has not marked it Actionable.

**Detection Idea:**  
Compare Work Station displayed tasks against FlowSpec's authoritative Actionability response. Any displayed task not in FlowSpec's Actionable list violates the invariant.

---

### INV-020: Flow Start Does Not Imply Actionability

**Statement:**  
Starting a Flow MUST NOT automatically make all its Entry Node Tasks Actionable. Actionability MUST be computed considering all constraints, including Cross-Flow Dependencies.

**Rationale:**  
Conflating Flow Start with Actionability breaks cross-flow coordination patterns and creates incorrect user expectations.

**Violation Example:**  
Execution Flow starts. The system immediately marks "Begin Installation" as Actionable, even though it has an unsatisfied Cross-Flow Dependency on Finance.

**Detection Idea:**  
On Flow creation, verify that Actionable Tasks are computed via constraint evaluation, not assumed from Entry Node designation alone.

---

### INV-021: Cross-Flow Dependencies Scoped to Flow Group

**Statement:**  
Cross-Flow Dependencies MUST only evaluate Outcomes within the same Flow Group. A Task MUST NOT have its Actionability affected by Flows outside its Flow Group.

**Rationale:**  
Flow Groups define the boundary of coordination. Cross-group dependencies would create unbounded coupling and evaluation complexity.

**Violation Example:**  
Task in Project A's Execution Flow becomes Actionable because Project B's Finance Flow recorded `DEPOSIT_COLLECTED`.

**Detection Idea:**  
Audit Cross-Flow Dependency evaluations. Verify that source Flow is always within the same Flow Group as the dependent Task's Flow.

---

### INV-022: Actionability Constraints Evaluated at Task Start Only

**Statement:**  
Actionability Constraints (including Cross-Flow Dependencies) MUST be evaluated when determining if a Task can be STARTED. Once a Task is started, Actionability Constraints MUST NOT be re-checked to block Outcome recording.

**Rationale:**  
A human who has started work on a Task has invested effort. Blocking Outcome recording due to later constraint changes (e.g., a Cross-Flow Dependency becoming unsatisfied) would orphan their work and create an unrecoverable state. Constraints gate the START of work, not the completion of work.

**Violation Example:**  
User starts Task T1 when Cross-Flow Dependency is satisfied. While working, the source Flow is rolled back (edge case). User attempts to record Outcome on T1, but system blocks because the dependency is now unsatisfied.

**Detection Idea:**  
Review Outcome recording logic. If any Actionability Constraint evaluation occurs at recording time (rather than start time), the invariant is violated.

---

### INV-023: Fan-Out Failure Preserves Outcome Truth but Blocks Flow

**Statement:**  
If fan-out instantiation fails, the recorded Outcome MUST remain valid and persisted (Truth is preserved). However, the triggering Flow MUST enter a BLOCKED state and cannot progress further.

**Rationale:**  
Outcomes are human-recorded Truth and MUST NOT be rolled back. However, fan-out represents a required coordination action. Allowing the parent Flow to proceed without successful fan-out creates orphaned downstream work and broken coordination. The Flow is blocked, but Truth is preserved.

**v2 Behavior:**  
- Outcome is recorded and preserved (no rollback)
- Triggering Flow enters BLOCKED state
- Failure is logged with context
- No automatic or manual retry mechanism in v2

**Violation Example:**  
User records Outcome `SIGNED` on Task S3.1. Fan-out rule triggers but Finance Workflow has no Published version. System rolls back the `SIGNED` Outcome. ← VIOLATION (Truth must be preserved)

**Correct Behavior:**  
User records Outcome `SIGNED` on Task S3.1. Fan-out fails. Outcome remains recorded. Flow enters BLOCKED state with visible failure reason.

**Detection Idea:**  
Simulate fan-out failure. Verify: (1) Outcome remains recorded, (2) Flow status is BLOCKED, (3) failure is logged. Any Outcome rollback OR silent progression indicates violation.

---

### INV-024: Gate Key is Node-Level

**Statement:**  
Gates MUST be keyed by `(nodeId, outcomeName)`. Within a Node, Tasks MUST NOT define conflicting routing targets for the same outcome name.

**Rationale:**  
Node-level routing maintains graph simplicity and comprehension. Task-level routing would create combinatorial complexity and fragment the visual graph model.

**Violation Example:**  
Node N1 contains Task T1 (Outcome `APPROVED` → N2) and Task T2 (Outcome `APPROVED` → N3). The same outcome name routes to different Nodes, creating ambiguity.

**Detection Idea:**  
During Workflow validation, group all Task Outcomes by (nodeId, outcomeName). If any group has conflicting target Nodes, fail validation.

---

### INV-025: Evidence Schema Required When Evidence Required

**Statement:**  
If a Task has `evidenceRequired: true`, the Task MUST have a non-null, valid `evidenceSchema`. A valid schema MUST have a `type` field with value `"file"`, `"text"`, or `"structured"`.

**Rationale:**  
Requiring evidence without defining what evidence is required creates an unachievable constraint. Users cannot provide conforming evidence if the schema is undefined. This also blocks validation rule 8.3.2 ("required Evidence achievable") from being satisfied.

**Violation Example:**  
Task "Upload Contract" has `evidenceRequired: true` but `evidenceSchema: null`. User attempts to attach evidence but system has no schema to validate against. At Outcome recording time, the system cannot determine if the evidence requirement is satisfied.

**Detection Idea:**  
During Workflow validation, for each Task where `evidenceRequired === true`, verify that `evidenceSchema` is non-null and contains a valid `type` field. Fail validation if not.

---

### INV-026: Structural Edits in DRAFT Only

**Statement:**  
Structural modifications (Nodes, Tasks, Outcomes, Gates) MUST ONLY be permitted when a Workflow is in the `DRAFT` state.

**Rationale:**  
Allowing structural changes in `VALIDATED` or `PUBLISHED` states would bypass validation integrity and version immutability. `VALIDATED` workflows have been certified as sound; any change requires re-certification.

**Violation Example:**  
A user patches a Gate's `targetNodeId` on a Workflow that is currently in `PUBLISHED` state.

**Detection Idea:**  
In the persistence layer gateway, assert `workflow.status === 'DRAFT'` for all structural mutation operations.

---

### INV-027: Template Library Immutability

**Statement:**  
WorkflowTemplate records MUST be immutable. Updates MUST be performed by inserting a new row with an incremented version.

**Rationale:**  
Templates serve as canonical sources for tenant workflows. In-place edits would destroy the record of what a tenant originally imported and prevent predictable version tracking.

**Violation Example:**  
An admin updates the `definition` of `WorkflowTemplate` version 1 to fix a typo.

**Detection Idea:**  
Implement write-protection on the `WorkflowTemplate` table at the DB or ORM level.

---

### INV-028: Provenance is Write-Once

**Statement:**
Workflow provenance fields (`templateId`, `templateVersion`, etc.) MUST be set exactly once during template import and MUST NOT be modified thereafter.

**Rationale:**
Provenance is a historical record of origin. If a tenant modifies these fields, the audit trail linking the workflow back to the Snapshot Library is broken.

**Violation Example:**
A user updates a Workflow's `templateId` to point to a different template after it was already imported.

**Detection Idea:**
In the persistence gateway, exclude provenance fields from the update path for Workflows.

---

### INV-029: Execution Step Ceiling

**Statement:**
A single Node MUST NOT exceed a defined iteration threshold (e.g., `MAX_NODE_ITERATIONS`).

**Rationale:**
Unbounded loops create infinite audit trails and resource exhaustion. A mechanical ceiling ensures runaway processes are contained while preserving the Truth of outcomes that triggered the loop.

**Violation Example:**
A Node is activated for the 1,001st time in a single Flow, continuing to record outcomes without intervention.

**Detection Idea:**
Check NodeActivation iteration counts against the system ceiling in the activation logic.

---

### INV-030: Analysis Purity

**Statement:**
Diagnostic and impact analysis modules MUST NOT mutate system state and MUST NOT import engine mutation or Truth recording layers.

**Rationale:**
Isolating "Observation" from "Execution" prevents side-effects during diagnosis and ensures the stability of the core engine.

**Violation Example:**
An "Impact Analysis" endpoint accidentally updates a workflow version timestamp while scanning for breaking changes.

**Detection Idea:**
CI guards enforcing import restrictions and read-only database connections for analysis modules.

---

### INV-031: Responsibility Isolation

**Statement:**  
FlowSpec MUST NOT depend on, import, or join with the Responsibility/Assignment Layer.  

**Rationale:**  
Execution truth must remain pure. Assignments are advisory metadata and must not influence the state machine.  

**Violation Example:**  
The FlowSpec engine queries `JobAssignment` to determine if a task can be started.

**Detection Idea:**  
CI guards (`guard_fs_iso_01.mjs`, `guard_fs_join_01.mjs`) monitoring imports and query patterns.

---

## 3. Invariant Index

| ID | Short Name | Category |
|----|------------|----------|
| INV-001 | No Work Outside Tasks | Execution |
| INV-002 | Explicit Outcomes Only | Outcomes |
| INV-003 | Gates Route Only | Gates |
| INV-004 | No Stage-Implied Readiness | Execution |
| INV-005 | No Floating Evidence | Evidence |
| INV-006 | Determinism | Derived State |
| INV-007 | Outcome Immutability | Outcomes |
| INV-008 | All Outcomes Routed | Gates |
| INV-009 | FlowSpec Owns Truth | Boundaries |
| INV-010 | Flow Bound to Version | Lifecycle |
| INV-011 | Published Immutable | Lifecycle |
| INV-012 | Graph-First Execution | Execution |
| INV-013 | No Inferred Task State | Execution |
| INV-014 | Entry Node Required | Structure |
| INV-015 | Terminal Path Required | Structure |
| INV-016 | Evidence at Recording | Evidence |
| INV-017 | Cross-Flow Dependencies User-Authored | Cross-Flow |
| INV-018 | Domains Do Not Trigger Domains | Boundaries |
| INV-019 | FlowSpec Evaluates Actionability | Boundaries |
| INV-020 | Flow Start ≠ Actionability | Cross-Flow |
| INV-021 | Cross-Flow Scoped to Flow Group | Cross-Flow |
| INV-022 | Actionability at Start Only | Execution |
| INV-023 | Fan-Out Failure ≠ Outcome Rollback | Fan-Out |
| INV-024 | Gate Key is Node-Level | Gates |
| INV-025 | Evidence Schema Required When Evidence Required | Evidence |
| INV-026 | Structural Edits in DRAFT Only | Lifecycle |
| INV-027 | Template Library Immutability | Templates |
| INV-028 | Provenance is Write-Once | Templates |
| INV-029 | Execution Step Ceiling | Execution |
| INV-030 | Analysis Purity | Boundaries |
| INV-031 | Responsibility Isolation | Boundaries |

---

**End of Document**
