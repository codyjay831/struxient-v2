# FlowSpec Glossary

**Document ID:** 00_flowspec_glossary  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [20_flowspec_invariants.md](./20_flowspec_invariants.md)
- [25_flowspec_breaking_changes.md](./25_flowspec_breaking_changes.md)
- [30_flowspec_examples.md](./30_flowspec_examples.md)
- [40_flowspec_builder_contract.md](./40_flowspec_builder_contract.md)
- [50_flowspec_builder_ui_api_map.md](./50_flowspec_builder_ui_api_map.md)
- [Work Station Contract](../workstation/10_workstation_contract.md)

---

## 1. Purpose

This document defines ALL terms used within the FlowSpec system. Every term MUST be understood precisely before reading other FlowSpec documentation.

**Rule:** If a term is used in FlowSpec documentation, it MUST be defined here. No exceptions.

---

## 2. Core Entity Definitions

### 2.1 FlowSpec

**Definition:** FlowSpec is the execution engine. It defines AND executes workflows. There is no separate workflow runner or engine.

**Clarification:**
- FlowSpec is NOT a configuration format consumed by another engine.
- FlowSpec IS the engine itself.
- The term "FlowSpec" may also refer to the system as a whole.

---

### 2.2 Workflow (Specification)

**Definition:** A Workflow is a versioned, immutable graph specification that describes the structure, tasks, outcomes, and routing rules for a type of work.

**Clarification:**
- A Workflow is a SPECIFICATION (blueprint), not an execution.
- A Workflow defines what CAN happen, not what IS happening.
- Workflows are versioned and immutable once Published.
- **Source:** Workflows are created either from scratch (New Workflow) or imported from the **Template Library**.
- **Provenance:** Workflows imported from templates retain immutable references to their source `templateId` and `templateVersion`.
- Synonym in context: "Workflow Definition", "Workflow Spec"

**Lifecycle States:**
1. **Draft** — editable, not executable. All structural changes (Nodes, Tasks, Outcomes, Gates) occur here.
2. **Validated** — passed all validation checks, not yet executable. Structural edits are locked.
3. **Published** — immutable, executable.

---

### 2.2.1 Workflow Template

**Definition:** A Workflow Template is a system-defined, non-executing blueprint used as a starting point for creating tenant-owned Workflows.

**Clarification:**
- Templates exist in the **Template Library** (`WorkflowTemplate` table).
- Templates contain a complete `WorkflowSnapshot` JSON structure.
- Templates are global and do not belong to a specific tenant (Company).
- Importing a template clones its structure into a new tenant-owned Workflow in **Draft** state.
- Templates are immutable; updates require a new version row.

---

### 2.2.2 Provenance

**Definition:** Provenance is the record of a Workflow's origin when created from the Template Library.

**Clarification:**
- Provenance includes `templateId`, `templateVersion`, `importedAt`, and `importedBy`.
- Provenance fields are **write-once**; they are set at the moment of import and MUST NOT be modified thereafter.
- Provenance enables tracking which version of a system blueprint a tenant's workflow originated from.

---

### 2.3 Flow (Instance)

**Definition:** A Flow is a live execution instance of a Workflow. It represents the actual runtime state of work being executed against a specific Workflow version.

**Clarification:**
- A Flow is an INSTANCE of a Workflow.
- Multiple Flows may execute the same Workflow concurrently.
- A Flow is bound to a specific Workflow version at creation time.
- Flow state is mutable during execution.

**Relationship:**  
`Workflow (Specification) : Flow (Instance) = 1 : many`

---

### 2.3.1 Flow Start vs Task Actionability (CRITICAL DISTINCTION)

**Flow Start:** A Flow is "started" when it is instantiated from a Published Workflow. Starting a Flow makes it exist; it does NOT automatically make its Tasks Actionable.

**Task Actionability:** Tasks within a started Flow become Actionable only when:
1. The Task's containing Node is active (via Entry designation or Gate routing), AND
2. All Actionability Constraints on the Task are satisfied (see §2.10), AND
3. The Task has not yet recorded an Outcome.

**Rule:** Flow Start and Task Actionability are NOT equivalent. A Flow may be started with zero Actionable Tasks if Actionability Constraints are unsatisfied.

---

### 2.3.2 Flow Group

**Definition:** A Flow Group is a binding construct that associates multiple Flows executing concurrently for the same unit of work (e.g., a job, project, or engagement).

**Clarification:**
- A Flow Group contains one or more Flows.
- Flows within a Flow Group may be instantiated from different Workflows.
- Cross-Flow Dependencies (see §2.10) operate within a Flow Group.
- A Flow Group is created when the first Flow is instantiated for a unit of work.
- The Flow Group identifier links all related Flows.

**Relationship:**  
`Flow Group : Flow = 1 : many`

**Example:** A job may have a Sales Flow, Finance Flow, and Execution Flow running in parallel, all bound to the same Flow Group.

**Non-Goals (MUST NOT evolve into):**
- Flow Group MUST NOT become a parent workflow or super-state machine.
- Flow Group MUST NOT imply ordering between its member Flows.
- Flow Group MUST NOT contain execution logic, routing rules, or lifecycle states.
- Flow Group groups Flows; it does not control them.

**External Linkage:**  
A Flow Group MAY be referenced by an external domain artifact (e.g., Job) 
for human-facing navigation. This linkage is metadata only; the external 
artifact does NOT own, contain, or control the Flow Group or its Flows.

---

### 2.3.3 Scope (Flow Group Scope)

**Definition:** A Scope is the canonical identifier for the unit of work that a Flow Group represents. Scope is the binding key for Flow Group membership.

**Canonical Shape:**
```
{
  type: string,   // e.g., "job", "project", "engagement"
  id: string      // unique identifier within the type
}
```

**Rules:**
1. Flow creation MUST provide a `scope` parameter with both `type` and `id`.
2. A Flow Group is uniquely identified by its Scope — there is exactly one Flow Group per unique Scope (1:1 relationship).
3. If a `flowGroupId` is provided during Flow creation, the Engine MUST verify it matches the existing Flow Group for that Scope, or reject the request.
4. `flowGroupId` is a hint for optimization; Scope is authoritative.

**Clarification:**
- Scope defines WHAT the work is for (the business entity).
- Flow Group defines HOW multiple Flows are grouped together.
- The Engine enforces Scope → Flow Group 1:1 invariant.

**Example:**
```
scope: { type: "job", id: "job-12345" }
→ All Flows for job-12345 share the same Flow Group
```

**Anti-pattern:** Providing `flowGroupId` without verifying Scope match. The Engine MUST reject mismatches.

---

### 2.4 Node

**Definition:** A Node is a named container within a Workflow that groups one or more Tasks. Nodes define started/done semantics for the grouped Tasks.

**Clarification:**
- Nodes are structural groupings, not execution units.
- Work happens in Tasks, not Nodes.
- A Node is "started" when its first Task is started.
- A Node is "done" when all its Tasks are done (per its defined completion rule).
- Nodes MAY have dependencies on other Nodes (via Gate routing).

**Contains:** One or more Tasks

---

### 2.5 Task

**Definition:** A Task is the atomic unit of work within a Node. Tasks are the ONLY place where work is executed.

**Clarification:**
- All execution happens at the Task level.
- Tasks have explicit, enumerated Outcomes.
- A Task is "started" when work begins on it.
- A Task is "done" when an Outcome is recorded.
- Tasks MAY require Evidence before an Outcome can be recorded.

**Properties:**
- Name (identifier within Node)
- Allowed Outcomes (explicit enumeration)
- Evidence Requirements (optional)

---

### 2.6 Evidence

**Definition:** Evidence is data attached to a Task that supports or justifies an Outcome. Evidence is always attached to a specific Task.

**Clarification:**
- Evidence is NOT floating or unattached.
- Evidence is NOT stored at the Node, Flow, or Workflow level.
- Evidence requirements are defined per-Task.
- Evidence MAY be required before an Outcome can be recorded.
- Evidence types and validation rules are defined in the Workflow specification.

**Rule:** There is no such thing as "floating evidence" — all Evidence MUST be attached to exactly one Task.

---

### 2.7 Outcome

**Definition:** An Outcome is an explicit, enumerated result of completing a Task. Outcomes are the ONLY mechanism for marking a Task as done.

**Clarification:**
- Outcomes are NOT inferred, computed, or derived.
- Outcomes MUST be explicitly recorded.
- Each Task defines its allowed Outcomes in advance.
- An Outcome recorded on a Task is immutable.
- Outcomes drive Gate routing.

**Examples of valid Outcomes:**
- `APPROVED`
- `REJECTED`
- `REQUIRES_REMEDIATION`
- `COMPLETE`
- `FAILED`

**Anti-pattern:** Outcomes like `IN_PROGRESS`, `STARTED`, `PENDING` are NOT valid — these are states, not outcomes.

---

### 2.8 Gate

**Definition:** A Gate is a routing mechanism that determines which Node(s) to activate next based on the Outcome of a Task or Node completion.

**Clarification:**
- Gates route. Gates do NOT decide completion.
- Gates do NOT represent status, progress, or stages.
- Gates evaluate Outcomes and route to target Nodes.
- Gates MAY route to multiple Nodes (fan-out).
- Gates MAY route back to previous Nodes (cycles/loops).
- Gates MUST have a route defined for every possible Outcome they evaluate.

**Rule:** If a Gate evaluates an Outcome, every possible value of that Outcome MUST have a defined route. No orphaned Outcomes.

---

## 3. State and Truth Definitions

### 3.1 Truth

**Definition:** Truth is the authoritative, persisted state of a Flow's execution. Truth is the source of record for what has happened.

**Clarification:**
- Truth is stored, not computed.
- Truth includes: which Tasks have started, which Tasks have Outcomes, what Evidence is attached, what Outcomes were recorded.
- Truth is append-only during execution (no retroactive edits).
- Truth is owned exclusively by FlowSpec.

**Rule:** Only FlowSpec may mutate execution Truth. External domains may NOT directly modify Truth.

**Terminology Note:** The term "record" in Struxient documentation refers to 
persisted data entries. However, only FlowSpec Truth tables are authoritative 
for execution state. Domain artifacts like Jobs and Customers are metadata 
records—they are persisted and meaningful, but they project or reference 
FlowSpec Truth rather than owning it.

---

### 3.2 Derived State (Signals)

**Definition:** Derived State (also called Signals) is computed, non-authoritative state derived from Truth. Derived State is recalculated on demand.

**Clarification:**
- Derived State is NOT stored as authoritative.
- Derived State is computed from Truth.
- Derived State includes: "current actionable tasks", "nodes in progress", "flow completion percentage".
- Derived State MAY be cached but cache is not authoritative.
- Same Truth MUST always produce the same Derived State (determinism).

**Examples:**
- "Which Tasks can be worked on now?" — Derived
- "What is the next Node?" — Derived
- "Is the Flow complete?" — Derived
- "What Outcome was recorded for Task X?" — Truth

---

### 3.3 Actionable

**Definition:** Actionable describes a Task or set of Tasks that are currently eligible to be worked on, based on Derived State computed from Truth.

**Clarification:**
- "Actionable" is a Derived State concept.
- A Task is Actionable when ALL of the following are true:
  1. The Task's containing Node is active (via Entry or Gate routing)
  2. All Actionability Constraints on the Task are satisfied (see §3.4)
  3. The Task has not yet recorded an Outcome
- External domains query for Actionable Tasks; they do NOT compute this themselves.

**Rule:** FlowSpec is the sole authority on Actionability. External domains MUST NOT infer, compute, or override Actionability.

---

### 3.4 Actionability Constraint

**Definition:** An Actionability Constraint is a user-authored precondition that MUST be satisfied before a Task becomes Actionable. Constraints are defined in the Workflow specification via the Builder.

**Types of Actionability Constraints:**

| Constraint Type | Description |
|-----------------|-------------|
| Within-Flow Gate | Task's Node must be activated by Gate routing (standard behavior) |
| Cross-Flow Dependency | A specific Outcome must be recorded in another Flow within the same Flow Group |

**Clarification:**
- Actionability Constraints are authored by the user in the FlowSpec Builder.
- Actionability Constraints are evaluated by FlowSpec, not by external domains.
- All Constraints must be satisfied for a Task to be Actionable (logical AND).
- Constraints are part of the Workflow specification and are immutable once Published.

---

### 3.5 Cross-Flow Dependency

**Definition:** A Cross-Flow Dependency is an Actionability Constraint where a Task in one Flow requires a specific Outcome to be recorded on a Task in another Flow (within the same Flow Group) before becoming Actionable.

**Clarification:**
- Cross-Flow Dependencies are user-authored in the FlowSpec Builder.
- Cross-Flow Dependencies operate within a Flow Group only.
- FlowSpec evaluates all Cross-Flow Dependencies; external domains do not.
- Cross-Flow Dependencies do NOT cause one domain to "trigger" another — they gate Actionability.

**Example:**  
Task "Begin Installation" in the Execution Flow has a Cross-Flow Dependency on Outcome `DEPOSIT_COLLECTED` from the Finance Flow. The Task exists and its Flow is started, but it is not Actionable until Finance records that Outcome.

**Rule:** Cross-Flow Dependencies are constraints, not triggers. FlowSpec evaluates constraints; no domain triggers another.

---

### 3.6 Projection Surface

**Definition:** A Projection Surface is any domain artifact that displays, 
aggregates, or caches FlowSpec Truth for human consumption. Projection 
Surfaces do NOT own Truth.

**Clarification:**
- Job Cards are Projection Surfaces.
- Dashboards, reports, and status views are Projection Surfaces.
- Projection Surfaces MAY cache Derived State but MUST treat FlowSpec as authoritative.
- Projection Surfaces MUST NOT mutate Truth.

**Rule:** If a surface can be reconstructed entirely from FlowSpec Truth, 
it is a Projection Surface.

**Relationship to Truth:**
- Projection Surfaces read Truth (via FlowSpec APIs)
- Projection Surfaces never write Truth
- Projection Surfaces may display Derived State

---

## 4. Workflow Lifecycle Definitions

### 4.1 Draft

**Definition:** A Workflow in Draft state is editable and NOT executable. Flows cannot be created from a Draft Workflow.

---

### 4.2 Validated

**Definition:** A Workflow in Validated state has passed all structural and semantic validation checks. It is still NOT executable until Published.

**Validation includes:**
- All Nodes reachable
- All Task Outcomes have Gate routes
- No orphaned Outcomes
- No structural cycles without explicit loop acknowledgment (if policy requires)
- Evidence requirements well-formed

---

### 4.3 Published

**Definition:** A Workflow in Published state is immutable and executable. Flows can be created from a Published Workflow.

**Rule:** Once Published, a Workflow version cannot be edited. To change, create a new version.

---

### 4.4 Publish (Action)

**Definition:** Publish is the action of transitioning a Workflow from Validated to Published state, making it immutable and executable.

---

## 5. Specification vs Instance Clarification

| Concept | Specification (Design-Time) | Instance (Run-Time) |
|---------|---------------------------|---------------------|
| Workflow Definition | Workflow | Flow |
| Node Definition | Node (in Workflow) | Node State (in Flow) |
| Task Definition | Task (in Workflow) | Task State (in Flow) |
| Outcome Definition | Allowed Outcomes (enumerated) | Recorded Outcome (single value) |
| Evidence Requirement | Evidence Schema (in Task) | Attached Evidence (in Task State) |

**Rule:** Always be explicit about whether you are referring to the Specification or the Instance.

---

## 6. Truth vs Derived Clarification

| Question | Truth or Derived? |
|----------|------------------|
| What Outcome was recorded for Task X? | Truth |
| When was Task X started? | Truth |
| What Evidence is attached to Task X? | Truth |
| Which Tasks are currently actionable? | Derived |
| Is Node Y complete? | Derived |
| What is the "status" of the Flow? | Derived |
| Which Node should activate next? | Derived |

**Rule:** If you can answer the question by looking at a single stored record, it's Truth. If you must compute across multiple records or apply rules, it's Derived.

---

## 7. Prohibited Terminology

The following terms are PROHIBITED in FlowSpec documentation and implementation to prevent semantic confusion:

| Prohibited Term | Reason | Use Instead |
|-----------------|--------|-------------|
| Stage | Implies linear progression | Node |
| Status | Ambiguous (Truth vs Derived) | Outcome (for Tasks), Derived State (for queries) |
| Pipeline | Implies linear, one-way flow | Workflow / Graph |
| Step | Ambiguous granularity | Task (for work), Node (for grouping) |
| Phase | Implies linear progression | Node |
| Progress | Implies percentage/linear | Derived State |
| Advance | Implies manual progression | Route (via Gate) |
| Move to next | Implies manual/linear progression | Outcome + Gate routing |

---

## 8. Glossary Index (Alphabetical)

| Term | Section |
|------|---------|
| Actionable | 3.3 |
| Actionability Constraint | 3.4 |
| Cross-Flow Dependency | 3.5 |
| Derived State | 3.2 |
| Draft | 4.1 |
| Evidence | 2.6 |
| Flow | 2.3 |
| Flow Group | 2.3.2 |
| Scope (Flow Group Scope) | 2.3.3 |
| Flow Start vs Task Actionability | 2.3.1 |
| FlowSpec | 2.1 |
| Gate | 2.8 |
| Node | 2.4 |
| Outcome | 2.7 |
| Publish | 4.4 |
| Published | 4.3 |
| Signals | 3.2 |
| Task | 2.5 |
| Truth | 3.1 |
| Projection Surface | 3.6 |
| Validated | 4.2 |
| Workflow | 2.2 |

---

**End of Document**
