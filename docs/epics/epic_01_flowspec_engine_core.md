# epic_01_flowspec_engine_core.md

**Epic ID:** EPIC-01  
**Title:** FlowSpec Engine Core  
**Status:** SPECIFICATION  
**Canon Sources:** 00_flowspec_glossary.md, 10_flowspec_engine_contract.md, 20_flowspec_invariants.md

---

## 1. Purpose

Implement the FlowSpec execution engine — the authoritative **Truth Store** responsible for defining and executing workflows. The engine owns all execution Truth, computes all Derived State, evaluates all Actionability, and routes all execution based on Outcomes and Gates.

### 1.1 Authorization Boundary

> **Tenant Isolation:** The FlowSpec Engine does NOT perform authorization checks. It trusts that the API layer has verified tenant ownership (actor's `companyId` matches Flow's `companyId`) before invoking any Truth mutation. This boundary is explicit: the engine processes requests, it does not authorize them.

---

## 2. In-Scope Responsibilities

- Execute workflows as directed graphs of Nodes and Tasks
- Record and persist execution Truth (Task starts, Outcomes, Evidence attachments, Node activations)
- Compute Derived State (Actionable Tasks, Node completion, Flow completion)
- Evaluate Gate routing when Outcomes are recorded
- Enforce Node completion rules (ALL_TASKS_DONE, ANY_TASK_DONE, SPECIFIC_TASKS_DONE)
- Support workflow cycles (loops back to previous Nodes)
- Bind Flows to specific Workflow versions at creation time
- Maintain determinism guarantee (same Truth → same Derived State)

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Canon Source |
|---|----------|--------------|
| 3.1 | User identity or authentication | 10_flowspec_engine_contract.md §3.1 |
| 3.2 | Define permissions or role hierarchies | 10_flowspec_engine_contract.md §3.2 |
| 3.3 | Provide UI components | 10_flowspec_engine_contract.md §3.3 |
| 3.4 | Store business data unrelated to execution | 10_flowspec_engine_contract.md §3.4 |
| 3.5 | Implement domain logic for Sales, Finance, Admin, or Work Station | 10_flowspec_engine_contract.md §3.5 |
| 3.6 | Schedule or time-trigger executions | 10_flowspec_engine_contract.md §3.6 |
| 3.7 | Send notifications or alerts | 10_flowspec_engine_contract.md §3.7 |
| 3.8 | Manage UI theming | 10_flowspec_engine_contract.md §3.8 |

---

## 4. Authoritative Requirements

### 4.1 Execution Hierarchy

- **MUST** enforce hierarchy: Flow → Workflow → Node[] → Task[] → Outcome[] + Evidence
  - *Source: 10_flowspec_engine_contract.md §4.1*

### 4.2 Task Semantics

- **MUST** only allow Task start if Task is Actionable
  - *Source: 10_flowspec_engine_contract.md §5.1.1*
- **MUST** record Task start in Truth
  - *Source: 10_flowspec_engine_contract.md §5.1.1*
- **MUST** only allow Task start once per Flow execution (unless explicit loop routing)
  - *Source: 10_flowspec_engine_contract.md §5.1.1*
- **MUST** require Outcome to be one of Task's defined allowed Outcomes
  - *Source: 10_flowspec_engine_contract.md §5.1.2*
- **MUST** make Outcome recording immutable — cannot be changed
  - *Source: 10_flowspec_engine_contract.md §5.1.2*
- **MUST** trigger Gate evaluation when Outcome is recorded
  - *Source: 10_flowspec_engine_contract.md §5.1.2*

### 4.3 Node Semantics

- **MUST** record NodeActivated event in Truth when Node is activated
  - *Source: 10_flowspec_engine_contract.md §5.2.1*
- **MUST** compute Node "started" as Derived State from Task start timestamps
  - *Source: 10_flowspec_engine_contract.md §5.2.2*
- **MUST** compute Node "done" as Derived State from Node completion rule
  - *Source: 10_flowspec_engine_contract.md §5.2.3*
- **MUST** support completion rules: ALL_TASKS_DONE, ANY_TASK_DONE, SPECIFIC_TASKS_DONE
  - *Source: 10_flowspec_engine_contract.md §5.2.3*
- **MUST** default to ALL_TASKS_DONE if unspecified
  - *Source: 10_flowspec_engine_contract.md §5.2.3*

### 4.4 Gate Semantics

- **MUST** key Gates by (nodeId, outcomeName) — routing operates at Node level
  - *Source: 10_flowspec_engine_contract.md §5.5.2.1*
- **MUST NOT** allow conflicting routing targets for same outcome name within a Node
  - *Source: 10_flowspec_engine_contract.md §5.5.2.1*
- **MUST** evaluate Gates when Outcome is recorded, not based on state/progress/time
  - *Source: 10_flowspec_engine_contract.md §5.5.1*
- **MUST** support Gate routing to: zero Nodes (terminal), one Node (linear), multiple Nodes (fan-out), previous Node (cycle)
  - *Source: 10_flowspec_engine_contract.md §5.5.2*

### 4.5 Cycle Policy

- **MUST** allow cycles in Workflows (loops back to previous Nodes)
  - *Source: 10_flowspec_engine_contract.md §6.1*
- **MUST** re-activate Node when Gate routes to previously visited Node
  - *Source: 10_flowspec_engine_contract.md §6.2*
- **MUST** preserve Task state from prior visits in Truth (audit trail)
  - *Source: 10_flowspec_engine_contract.md §6.2*
- **MUST** record new Outcomes as new entries, not overwrites
  - *Source: 10_flowspec_engine_contract.md §6.2*
- **MAY** implement configurable execution step limit as safety measure
  - *Source: 10_flowspec_engine_contract.md §6.3*

### 4.6 Determinism

- **MUST** produce identical Derived State given identical Truth
  - *Source: 10_flowspec_engine_contract.md §12*
- **MUST NOT** use randomness in Gate evaluation
  - *Source: 10_flowspec_engine_contract.md §12*
- **MUST NOT** use time-dependent routing unless time is recorded as Truth
  - *Source: 10_flowspec_engine_contract.md §12*
- **MUST NOT** allow external state to influence routing decisions
  - *Source: 10_flowspec_engine_contract.md §12*

### 4.7 Truth Ownership

- **MUST** be the sole owner of execution Truth
  - *Source: 00_flowspec_glossary.md §3.1*
- **MUST NOT** allow external domains to directly modify Truth
  - *Source: 10_flowspec_engine_contract.md §9.3*

---

## 5. System Boundaries & Ownership

| Owned by FlowSpec Engine | Delegated to Other Systems |
|--------------------------|---------------------------|
| Execution Truth storage | User authentication (Clerk) |
| Derived State computation | UI rendering (Builder, Work Station) |
| Actionability evaluation | Domain-specific business logic |
| Gate routing execution | Notification dispatch |
| Node activation recording | Scheduling/time triggers |
| Outcome recording | |
| Evidence attachment | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Concurrent Outcome Recording

**Scenario:** Two users attempt to record Outcomes on the same Task simultaneously.

**Required Behavior:**
- First submission succeeds and is recorded
- Second submission is rejected (Outcome already recorded)
- Rejection returns informative error code

*Source: 10_flowspec_engine_contract.md §5.4.2*

### 6.2 Gate Routing to Non-Existent Node

**Scenario:** Gate references a Node ID that does not exist.

**Required Behavior:**
- Validation catches this at Draft → Validated transition
- Runtime should never encounter this if validation is enforced

*Source: 10_flowspec_engine_contract.md §8.2.4*

### 6.3 Infinite Loop Detection

**Scenario:** Workflow contains cycle that never terminates.

**Required Behavior:**
- Engine MAY implement configurable step limit
- If limit exceeded, Flow is suspended (not terminated) with error state
- This is primarily a Workflow design problem, not engine problem

*Source: 10_flowspec_engine_contract.md §6.3*

### 6.4 Node Re-Activation in Cycle

**Scenario:** Gate routes back to previously completed Node.

**Required Behavior:**
- Node is re-activated
- Tasks become Actionable again
- Previous Outcomes remain in Truth (new Outcomes are new entries)

*Source: 10_flowspec_engine_contract.md §6.2*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-001 | No Work Outside Tasks | All execution occurs within Tasks only |
| INV-002 | Explicit Outcomes Only | Outcomes must be enumerated, not inferred |
| INV-003 | Gates Route Only | Gates do not decide completion |
| INV-004 | No Stage-Implied Readiness | Actionability from Gates only |
| INV-006 | Determinism | Same Truth → Same Derived State |
| INV-007 | Outcome Immutability | Recorded Outcomes cannot be changed |
| INV-009 | FlowSpec Owns Truth | Only FlowSpec mutates execution Truth |
| INV-010 | Flow Bound to Version | Flow bound to Workflow version at creation |
| INV-012 | Graph-First Execution | Execution order from graph, not display |
| INV-013 | No Inferred Task State | State from Truth only |
| INV-019 | FlowSpec Evaluates Actionability | Sole authority on Actionability |
| INV-022 | Actionability at Start Only | Constraints evaluated at Task start |
| INV-024 | Gate Key is Node-Level | Gates keyed by (nodeId, outcomeName) |

---

## 8. Implementation Notes

### 8.1 NodeActivated Event Shape

```
{
  flowId: string,
  nodeId: string,
  activatedAt: string  // ISO 8601
}
```
*Source: 10_flowspec_engine_contract.md §5.2.1*

### 8.2 Actionable Task Computation

A Task is Actionable when ALL of:
1. Task's containing Node is active (via Entry or Gate routing)
2. All Actionability Constraints are satisfied (including Cross-Flow Dependencies)
3. Task has not yet recorded an Outcome

*Source: 00_flowspec_glossary.md §3.3*

### 8.3 Truth vs Derived Distinction

| Truth (Stored) | Derived (Computed) |
|----------------|-------------------|
| Outcome recorded on Task X | Which Tasks are actionable |
| Task X started timestamp | Is Node Y complete |
| Evidence attached to Task X | What is the Flow "status" |
| Node activated event | Which Node should activate next |

*Source: 00_flowspec_glossary.md §6*

---

## 9. Acceptance Criteria

- [ ] Task can only start if Actionable
- [ ] Task start is recorded in Truth with timestamp
- [ ] Outcome must be in Task's allowed Outcomes list
- [ ] Outcome recording is rejected if Task not started
- [ ] Outcome recording triggers Gate evaluation
- [ ] Gate routes to correct target Node(s) based on Outcome
- [ ] Node re-activation in cycles creates new Task entries
- [ ] Determinism: replay of Truth produces identical Derived State
- [ ] External domains cannot mutate Truth directly
- [ ] Flow is permanently bound to Workflow version
- [ ] Node completion rules (ALL, ANY, SPECIFIC) work correctly
- [ ] Gates keyed by (nodeId, outcomeName) reject conflicting targets
- [ ] **Tenant Isolation:** Engine does not implement authorization; API layer is responsible for tenant verification before calling engine functions

#### Drift Protection (M0 Guards Required)

- [ ] `guard_flowspec_schema_constraints.mjs` passes (Truth tables have no `@updatedAt`, no `onDelete: Cascade`, no `actionable` columns)
- [ ] `guard_flowspec_truth_mutation_boundary.mjs` passes (only `src/lib/flowspec/**` can import Truth mutation functions)

---

## 10. Open Questions

None — canon complete.
