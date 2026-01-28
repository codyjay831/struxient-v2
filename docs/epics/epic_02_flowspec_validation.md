# epic_02_flowspec_validation.md

**Epic ID:** EPIC-02  
**Title:** FlowSpec Workflow Validation  
**Status:** SPECIFICATION  
**Canon Sources:** 10_flowspec_engine_contract.md, 20_flowspec_invariants.md, 40_flowspec_builder_contract.md

---

## 1. Purpose

Implement the validation system that ensures Workflow specifications are structurally sound, semantically correct, and safe to execute before transitioning from Draft to Validated state. Validation prevents invalid Workflows from being published and protects runtime execution from undefined behavior.

---

## 2. In-Scope Responsibilities

- Structural validation (Entry Nodes, reachability, orphan detection)
- Outcome/Gate validation (all Outcomes routed, Gate targets exist)
- Evidence validation (schemas well-formed, requirements achievable)
- Semantic validation (completion rules valid, cycle acknowledgment)
- Gate key conflict detection (same outcome name → same targets within Node)
- Cross-Flow Dependency validation (source Workflow/Task/Outcome exist)
- Return comprehensive error list with locations and descriptions
- Block transition to Validated state if any errors exist

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | UI rendering of validation errors | Builder UI responsibility (40_flowspec_builder_contract.md §6) |
| 3.2 | Auto-fix of validation errors | User must consciously fix issues |
| 3.3 | Partial validation (validate subset) | Full validation required for integrity |
| 3.4 | Runtime validation of Flows | Validation is design-time only |

---

## 4. Authoritative Requirements

### 4.1 Structural Validation

- **MUST** verify at least one Entry Node exists
  - *Source: 10_flowspec_engine_contract.md §8.1.1*
- **MUST** verify all Nodes are reachable from Entry Node(s)
  - *Source: 10_flowspec_engine_contract.md §8.1.2*
- **MUST** verify no orphan Tasks exist (Task in no Node)
  - *Source: 10_flowspec_engine_contract.md §8.1.3*
- **MUST** verify terminal path exists OR Workflow is explicitly marked non-terminating
  - *Source: 10_flowspec_engine_contract.md §8.1.4*

### 4.2 Outcome/Gate Validation

- **MUST** verify all Tasks have at least one defined Outcome
  - *Source: 10_flowspec_engine_contract.md §8.2.1*
- **MUST** verify all Outcomes have Gate routes defined
  - *Source: 10_flowspec_engine_contract.md §8.2.2*
- **MUST** verify no orphaned Outcomes (defined but never routed)
  - *Source: 10_flowspec_engine_contract.md §8.2.3*
- **MUST** verify all Gate targets reference existing Nodes
  - *Source: 10_flowspec_engine_contract.md §8.2.4*
- **MUST** verify no conflicting routes for same outcome name within a Node
  - *Source: 10_flowspec_engine_contract.md §5.5.2.1*

### 4.3 Evidence Validation

- **MUST** verify Evidence schemas are well-formed
  - *Source: 10_flowspec_engine_contract.md §8.3.1*
- **MUST** verify required Evidence is achievable (mechanism to provide exists)
  - *Source: 10_flowspec_engine_contract.md §8.3.2*

### 4.4 Semantic Validation

- **MUST** verify Node completion rules reference valid Tasks (for SPECIFIC_TASKS_DONE)
  - *Source: 10_flowspec_engine_contract.md §8.4.1*
- **MUST** verify cycle acknowledgment if Workflow contains cycles (if policy requires)
  - *Source: 10_flowspec_engine_contract.md §8.4.2*

### 4.5 Cross-Flow Dependency Validation

- **MUST** verify source Workflow exists and is Published (or same-version draft)
  - *Source: 10_flowspec_engine_contract.md §11.5*
- **MUST** verify source Task exists in source Workflow
  - *Source: 10_flowspec_engine_contract.md §11.5*
- **MUST** verify required Outcome is a defined Outcome on source Task
  - *Source: 10_flowspec_engine_contract.md §11.5*
- **MUST** flag circular cross-flow dependencies as errors (causes deadlock)
  - *Source: 10_flowspec_engine_contract.md §11.5*

### 4.6 Fan-Out Rule Validation

- **MUST** verify target Workflow exists and is Published
  - *Source: 10_flowspec_engine_contract.md §10.3.1*
- **MUST** verify trigger Outcome is a valid outcome name in source Node
  - *Source: 10_flowspec_engine_contract.md §10.3*
- **MUST** flag unbounded fan-out patterns as errors (same outcome cannot recursively trigger same workflow without limit)
  - *Source: 10_flowspec_engine_contract.md §10.3*
- **MUST** flag determinism violations (e.g., random or time-based fan-out) as errors
  - *Source: 10_flowspec_engine_contract.md §12*

### 4.7 Validation Output

- **MUST** return list of ALL errors, not just first error
  - *Source: 40_flowspec_builder_contract.md §7.3*
- **MUST** include for each error: severity, location, description, suggested fix
  - *Source: 40_flowspec_builder_contract.md §7.3*
- **MUST** categorize errors (structural, semantic, etc.)
  - *Source: 40_flowspec_builder_contract.md §7.3*
- **MUST** pass validation (return zero errors) to allow state transition
  - *Source: 40_flowspec_builder_contract.md §7.3*

### 4.8 State Transition Rules

- **MUST** run validation before Publish action
  - *Source: 40_flowspec_builder_contract.md §7.1*
- **MUST NOT** allow transition to Validated if any errors exist
  - *Source: 40_flowspec_builder_contract.md §6.2*

---

## 5. System Boundaries & Ownership

| Owned by Validation System | Delegated to Other Systems |
|---------------------------|---------------------------|
| Structural integrity checks | UI display of errors (Builder) |
| Outcome/Gate completeness | Error click navigation (Builder) |
| Evidence schema validation | User decision to fix |
| Cross-Flow Dependency checks | |
| Error aggregation and reporting | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Multiple Errors in Same Element

**Scenario:** A single Task has multiple validation errors (no Outcomes, unreachable).

**Required Behavior:**
- All errors are reported
- Each error has its own entry in the error list
- Location points to the specific element

### 6.2 Circular Cross-Flow Dependencies

**Scenario:** Workflow A depends on Workflow B which depends on Workflow A.

**Required Behavior:**
- Flagged as warning (not blocking error)
- Message indicates potential deadlock risk
- User may proceed if intentional

*Source: 10_flowspec_engine_contract.md §11.5*

### 6.3 Cross-Flow Dependency to Unpublished Workflow

**Scenario:** Dependency references a Workflow that is still in Draft state.

**Required Behavior:**
- Validation error if referencing different Workflow in Draft state
- Allowed if referencing same-version draft (self-dependency scenario)

### 6.4 Gate Conflict Detection

**Scenario:** Node contains Task T1 with Outcome APPROVED → N2 and Task T2 with Outcome APPROVED → N3.

**Required Behavior:**
- Validation error: "Conflicting routes for outcome 'APPROVED' in Node 'N1': Tasks define different target Nodes."

*Source: 10_flowspec_engine_contract.md §5.5.2.1*

---

## 7. Invariants Enforced

| ID | Invariant | Validation Check |
|----|-----------|------------------|
| INV-002 | Explicit Outcomes Only | Tasks must have defined Outcomes |
| INV-008 | All Outcomes Routed | Every Outcome has Gate route |
| INV-014 | Entry Node Required | At least one Entry Node exists |
| INV-015 | Terminal Path Required | Path to terminal or explicit non-terminating |
| INV-017 | Cross-Flow Dependencies User-Authored | Dependencies reference valid sources |
| INV-024 | Gate Key is Node-Level | No conflicting routes within Node |

---

## 8. Implementation Notes

### 8.1 Validation Error Format

```json
{
  "valid": false,
  "errors": [
    {
      "severity": "error",
      "category": "structural",
      "path": "nodes[0]",
      "code": "NO_ENTRY_NODE",
      "message": "No Node is marked as entry point",
      "suggestion": "Mark at least one Node as Entry Node"
    }
  ]
}
```

### 8.2 Validation Check Categories

| Category | Checks |
|----------|--------|
| structural | Entry Node, reachability, orphan Tasks, terminal path |
| outcome_gate | Outcomes defined, routes exist, no orphans, targets valid |
| evidence | Schema well-formed, requirements achievable |
| semantic | Completion rules valid, cycle acknowledgment |
| cross_flow | Source exists, Task exists, Outcome valid, no circular dependencies |
| fan_out | Target Workflow Published, trigger Outcome valid, no unbounded patterns |

### 8.3 Reachability Algorithm

Graph traversal from all Entry Nodes. Any Node not visited is unreachable.

### 8.4 Terminal Path Detection

Traverse all paths from Entry Nodes. At least one path must lead to a Node with an Outcome that routes to null (terminal).

---

## 9. Acceptance Criteria

- [ ] Validation detects missing Entry Node
- [ ] Validation detects unreachable Nodes
- [ ] Validation detects Tasks with zero Outcomes
- [ ] Validation detects Outcomes without Gate routes
- [ ] Validation detects Gate targets that don't exist
- [ ] Validation detects conflicting routes for same outcome name in Node
- [ ] Validation detects missing terminal path (unless non-terminating)
- [ ] Validation detects invalid Evidence schemas
- [ ] Validation detects Cross-Flow Dependencies to non-existent sources
- [ ] Validation detects circular cross-flow dependencies as errors
- [ ] Validation detects Fan-Out Rules targeting unpublished Workflows
- [ ] Validation detects Fan-Out Rules with invalid trigger Outcomes
- [ ] Validation detects unbounded fan-out patterns as errors
- [ ] Validation returns ALL errors, not just first
- [ ] Each error includes severity, location, description, suggestion
- [ ] Zero errors allows transition to Validated
- [ ] Any error blocks transition to Validated

#### Drift Protection

- [ ] `guard_flowspec_schema_constraints.mjs` passes (FanOutFailure model has no retry-related fields)

---

## 10. Open Questions

None — canon complete.
