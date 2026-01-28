# epic_05_flowspec_cross_flow_dependencies.md

**Epic ID:** EPIC-05  
**Title:** FlowSpec Cross-Flow Dependencies  
**Status:** SPECIFICATION  
**Canon Sources:** 00_flowspec_glossary.md, 10_flowspec_engine_contract.md, 20_flowspec_invariants.md, 30_flowspec_examples.md

---

## 1. Purpose

Implement the Cross-Flow Dependency system that enables Tasks in one Flow to gate their Actionability based on Outcomes recorded in another Flow within the same Flow Group. This enables complex coordination patterns between parallel Flows without coupling domains.

---

## 2. In-Scope Responsibilities

- Define Cross-Flow Dependencies in Workflow specification (via Builder)
- Evaluate Cross-Flow Dependencies as part of Actionability computation
- Scope Cross-Flow Dependency evaluation to Flow Group only
- Evaluate dependencies at Task start time, not Outcome recording time
- Combine with within-Flow Gate routing for full Actionability determination

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Cross-Flow triggering | Dependencies are constraints, not triggers (00_flowspec_glossary.md §3.5) |
| 3.2 | Domain-to-domain communication | All coordination through FlowSpec only (INV-018) |
| 3.3 | Dependencies across Flow Groups | Scoped to Flow Group only (INV-021) |
| 3.4 | Auto-generated dependencies | Must be user-authored (INV-017) |
| 3.5 | Re-evaluation at Outcome recording | Evaluated at Task start only (INV-022) |

---

## 4. Authoritative Requirements

### 4.1 Cross-Flow Dependency Definition

- **MUST** be user-authored in FlowSpec Builder
  - *Source: 20_flowspec_invariants.md INV-017*
- **MUST NOT** be inferred, auto-generated, or created by external domains
  - *Source: 20_flowspec_invariants.md INV-017*
- **MUST** be defined per-Task in Workflow specification
  - *Source: 10_flowspec_engine_contract.md §11.3*
- **MUST** specify: source Workflow, source Task, required Outcome
  - *Source: 10_flowspec_engine_contract.md §11.3*
- **MUST** be immutable once Workflow is Published
  - *Source: 00_flowspec_glossary.md §3.4*

### 4.2 Cross-Flow Dependency Evaluation

- **MUST** evaluate as part of Derived State computation (Actionability)
  - *Source: 10_flowspec_engine_contract.md §11.3*
- **MUST** check if any Flow in the Flow Group (of specified Workflow type) has recorded the required Outcome
  - *Source: 10_flowspec_engine_contract.md §11.3*
- **MUST** be evaluated by FlowSpec, not by external domains
  - *Source: 00_flowspec_glossary.md §3.4*
- Task with Cross-Flow Dependency is NOT Actionable until dependency is satisfied
  - *Source: 10_flowspec_engine_contract.md §11.3*

### 4.3 Actionability Rules

A Task is Actionable when ALL of:
1. Task's containing Node is active (via Entry or Gate routing)
2. All Actionability Constraints (including Cross-Flow Dependencies) are satisfied
3. Task has not yet recorded an Outcome

*Source: 00_flowspec_glossary.md §3.3*

- All constraints must be satisfied (logical AND)
  - *Source: 00_flowspec_glossary.md §3.4*

### 4.4 Flow Group Scope

- **MUST** only evaluate Outcomes within the same Flow Group
  - *Source: 20_flowspec_invariants.md INV-021*
- Task MUST NOT have Actionability affected by Flows outside its Flow Group
  - *Source: 20_flowspec_invariants.md INV-021*

### 4.5 Evaluation Timing

- **MUST** evaluate constraints when determining if Task can be STARTED
  - *Source: 20_flowspec_invariants.md INV-022*
- **MUST NOT** re-check constraints to block Outcome recording once Task is started
  - *Source: 20_flowspec_invariants.md INV-022*

### 4.6 Flow Start vs Actionability

- **MUST NOT** automatically make Tasks Actionable just because Flow started
  - *Source: 20_flowspec_invariants.md INV-020*
- A Flow may be started with zero Actionable Tasks if constraints are unsatisfied
  - *Source: 00_flowspec_glossary.md §2.3.1*

### 4.7 Cross-Flow Dependencies Are Not Triggers

- Cross-Flow Dependencies gate Actionability; they do not cause one domain to "trigger" another
  - *Source: 00_flowspec_glossary.md §3.5*
- No domain triggers another domain
  - *Source: 20_flowspec_invariants.md INV-018*

---

## 5. System Boundaries & Ownership

| Owned by Cross-Flow System | Delegated to Other Systems |
|---------------------------|---------------------------|
| Dependency definition storage | Builder UI for authoring |
| Dependency evaluation logic | Within-Flow Gate routing (Engine Core) |
| Flow Group scoping | Outcome recording (Engine Core) |
| Actionability constraint combination | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Cross-Flow Dependency Satisfied After Flow Start

**Scenario:** Execution Flow starts. Task "Schedule Installation" has dependency on Finance Outcome DEPOSIT_COLLECTED. Finance records the Outcome later.

**Required Behavior:**
- Execution Flow starts with Entry Node active
- "Schedule Installation" is NOT Actionable initially
- When Finance records DEPOSIT_COLLECTED, FlowSpec re-computes Derived State
- "Schedule Installation" becomes Actionable

*Source: 10_flowspec_engine_contract.md §11.4*

### 6.2 Dependency on Source Flow That Doesn't Exist

**Scenario:** Execution Flow has dependency on Finance Flow, but Finance Flow not yet instantiated.

**Required Behavior:**
- Dependency is unsatisfied
- Task remains not Actionable
- When Finance Flow is created and records required Outcome, dependency becomes satisfied

### 6.3 Started Task Continues Despite Dependency Change

**Scenario:** Task T1 starts when dependency is satisfied. While working, source Outcome is somehow invalidated (edge case, e.g., Flow rollback).

**Required Behavior:**
- Task T1 remains started
- User can still record Outcome on T1
- Constraints are NOT re-evaluated at Outcome recording time

*Source: 20_flowspec_invariants.md INV-022*

### 6.4 Bidirectional Cross-Flow Dependencies

**Scenario:** Finance waits for Execution; Execution waits for Finance (different Tasks).

**Required Behavior:**
- Both dependencies evaluate independently
- Each dependency satisfied when its required Outcome is recorded
- No deadlock if dependencies are on different Tasks with different timing

*Source: 30_flowspec_examples.md §5.7*

### 6.5 Circular Cross-Flow Dependencies (Potential Deadlock)

**Scenario:** Task A in Flow 1 depends on Task B in Flow 2; Task B in Flow 2 depends on Task A in Flow 1.

**Required Behavior:**
- Validation flags as warning (potential deadlock)
- If published, both Tasks remain not Actionable indefinitely
- This is a Workflow design problem

*Source: 10_flowspec_engine_contract.md §11.5*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-017 | Cross-Flow Dependencies User-Authored | Must be explicitly authored in Builder |
| INV-018 | Domains Do Not Trigger Domains | Dependencies are constraints, not triggers |
| INV-019 | FlowSpec Evaluates Actionability | External domains don't compute this |
| INV-020 | Flow Start ≠ Actionability | Starting Flow doesn't auto-make Tasks Actionable |
| INV-021 | Cross-Flow Scoped to Flow Group | Dependencies only within Flow Group |
| INV-022 | Actionability at Start Only | Constraints not re-checked at Outcome recording |

---

## 8. Implementation Notes

### 8.1 Cross-Flow Dependency Schema

```json
{
  "taskId": "E1.1",
  "crossFlowDependencies": [
    {
      "sourceWorkflowId": "finance-workflow",
      "sourceTaskId": "F1.1",
      "requiredOutcome": "DEPOSIT_COLLECTED"
    }
  ]
}
```

### 8.2 Actionability Computation Algorithm

```
function isActionable(task, flow, flowGroup):
  // 1. Check Node is active
  if not isNodeActive(task.nodeId, flow):
    return false
  
  // 2. Check within-Flow constraints (Gate routing)
  if not meetsWithinFlowConstraints(task, flow):
    return false
  
  // 3. Check Cross-Flow Dependencies
  for dependency in task.crossFlowDependencies:
    if not isCrossFlowDependencySatisfied(dependency, flowGroup):
      return false
  
  // 4. Check Task not already done
  if hasOutcome(task, flow):
    return false
  
  return true
```

### 8.3 Cross-Flow Dependency Satisfaction Check

```
function isCrossFlowDependencySatisfied(dependency, flowGroup):
  // Find all Flows in Flow Group of the specified Workflow type
  flows = flowGroup.getFlowsByWorkflowId(dependency.sourceWorkflowId)
  
  for flow in flows:
    // Check if required Outcome has been recorded
    if hasOutcome(dependency.sourceTaskId, flow, dependency.requiredOutcome):
      return true
  
  return false
```

### 8.4 Example: Finance Gates Execution

| Step | Event | Actionable Tasks |
|------|-------|------------------|
| 1 | Sales records SIGNED | Fan-out triggers |
| 2 | Finance + Execution Flows created | F1.1 Actionable; E1.1 NOT Actionable |
| 3 | Finance records DEPOSIT_COLLECTED | F2.1 NOT Actionable; E1.1 becomes Actionable |
| 4 | Execution records INSTALLATION_COMPLETE | F2.1 becomes Actionable |

*Source: 30_flowspec_examples.md §5.7*

---

## 9. Acceptance Criteria

- [ ] Cross-Flow Dependencies can be defined per-Task in Workflow specification
- [ ] Dependencies specify source Workflow, Task, and required Outcome
- [ ] Task with unsatisfied dependency is NOT Actionable
- [ ] Task becomes Actionable when dependency is satisfied
- [ ] Dependencies only evaluate within same Flow Group
- [ ] Dependency on Outcome from different Flow Group has no effect
- [ ] Dependencies are evaluated at Task start time
- [ ] Started Task can record Outcome even if dependency later changes
- [ ] Flow can start with zero Actionable Tasks if all dependencies unsatisfied
- [ ] Bidirectional dependencies (Finance ↔ Execution) work correctly
- [ ] Validation warns about circular dependencies
- [ ] External domains cannot compute or override Actionability

#### Drift Protection

- [ ] `guard_flowspec_schema_constraints.mjs` passes (no `actionable` column on Task models — Actionability is Derived State)
- [ ] `guard_flowspec_truth_mutation_boundary.mjs` passes (external domains cannot bypass FlowSpec to compute Actionability)

---

## 10. Open Questions

None — canon complete.
