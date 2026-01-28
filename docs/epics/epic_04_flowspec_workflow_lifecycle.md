# epic_04_flowspec_workflow_lifecycle.md

**Epic ID:** EPIC-04  
**Title:** FlowSpec Workflow Lifecycle  
**Status:** SPECIFICATION  
**Canon Sources:** 00_flowspec_glossary.md, 10_flowspec_engine_contract.md, 20_flowspec_invariants.md, 40_flowspec_builder_contract.md

---

## 1. Purpose

Implement the Workflow lifecycle state machine that governs how Workflows transition between Draft, Validated, and Published states. This includes version management, immutability enforcement for Published Workflows, and branching from existing versions.

### 1.1 Authorization Boundary

> **Tenant Isolation:** All lifecycle transitions require that the actor's `companyId` matches the Workflow's `companyId`. The API layer validates this before invoking lifecycle logic. The lifecycle system does NOT perform authorization—it trusts upstream validation.

---

## 2. In-Scope Responsibilities

- Manage Workflow states: Draft, Validated, Published
- Enforce state transition rules
- Enforce immutability of Published Workflows
- Manage Workflow versioning
- Support branching (create Draft from Published version)
- Allow Validated → Draft reversion for edits

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Version deprecation policy | Policy concern, not engine concern (10_flowspec_engine_contract.md §7.3) |
| 3.2 | UI for version management | Builder responsibility (40_flowspec_builder_contract.md §8) |
| 3.3 | Version comparison/diff | Optional Builder feature |
| 3.4 | Migration of existing Flows to new version | Flows bound to version at creation |

---

## 4. Authoritative Requirements

### 4.1 Lifecycle States

| State | Editable | Executable | Description |
|-------|----------|------------|-------------|
| Draft | Yes | No | Work in progress. May be incomplete or invalid. |
| Validated | No* | No | Passed all validation. Ready to publish. |
| Published | No | Yes | Immutable. Flows can be created. |

*Validated can revert to Draft for edits.

*Source: 10_flowspec_engine_contract.md §7.1*

### 4.2 State Transitions

- **MUST** allow: Draft → Validated (via Validate action, requires passing validation)
  - *Source: 10_flowspec_engine_contract.md §7.2*
- **MUST** allow: Validated → Draft (via Edit action, reverts for changes)
  - *Source: 10_flowspec_engine_contract.md §7.2*
- **MUST** allow: Validated → Published (via Publish action)
  - *Source: 10_flowspec_engine_contract.md §7.2*
- **MUST NOT** allow: Published → any other state (terminal, no transitions out)
  - *Source: 10_flowspec_engine_contract.md §7.2*

### 4.3 Draft Rules

- **MUST** allow Drafts to be freely editable
  - *Source: 40_flowspec_builder_contract.md §8.1*
- **MAY** allow multiple Drafts for same Workflow
  - *Source: 40_flowspec_builder_contract.md §8.1*
- **MUST NOT** allow Flows to be created from Draft Workflows
  - *Source: 40_flowspec_builder_contract.md §8.1*
- **MAY** discard Drafts without affecting Published versions
  - *Source: 40_flowspec_builder_contract.md §8.1*

### 4.4 Publish Rules

- **MUST** require passing validation before Publish
  - *Source: 40_flowspec_builder_contract.md §8.2*
- **MUST** create new immutable version on Publish
  - *Source: 40_flowspec_builder_contract.md §8.2*
- **MUST NOT** modify or delete previous Published versions
  - *Source: 40_flowspec_builder_contract.md §8.2*
- Publishing is NOT undoable (creates new version instead)
  - *Source: 40_flowspec_builder_contract.md §5.4*

### 4.5 Versioning Rules

- **MUST** assign unique version identifier to each Published Workflow
  - *Source: 10_flowspec_engine_contract.md §7.3*
- **MUST NOT** mutate previous Published version when creating new one
  - *Source: 10_flowspec_engine_contract.md §7.3*
- Existing Flows continue executing against their bound Workflow version
  - *Source: 10_flowspec_engine_contract.md §7.3*
- New Flows may be created against any Published version (unless deprecated)
  - *Source: 10_flowspec_engine_contract.md §7.3*

### 4.6 Published Immutability

- **MUST NOT** allow modification of Published Workflow
  - *Source: 20_flowspec_invariants.md INV-011*
- Any change requires creating a new version
  - *Source: 20_flowspec_invariants.md INV-011*
- **MUST** implement write protection on Published Workflow records
  - *Source: 20_flowspec_invariants.md INV-011*

### 4.7 Branching

- **MUST** allow creating new Draft from any Published version
  - *Source: 40_flowspec_builder_contract.md §8.3*
- **MUST** allow viewing any Published version (read-only)
  - *Source: 40_flowspec_builder_contract.md §8.3*
- **MAY** support version comparison (diff view is optional)
  - *Source: 40_flowspec_builder_contract.md §8.3*

---

## 5. System Boundaries & Ownership

| Owned by Lifecycle System | Delegated to Other Systems |
|--------------------------|---------------------------|
| State transition enforcement | Validation execution (Validation epic) |
| Version creation and numbering | UI for state changes (Builder) |
| Immutability enforcement | Version deprecation policy |
| Branching from versions | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Publish Without Validation

**Scenario:** Attempt to Publish a Workflow that hasn't passed validation.

**Required Behavior:**
- Publish action is rejected
- Error indicates validation required first
- Workflow remains in current state

### 6.2 Edit Published Workflow

**Scenario:** Attempt to modify a Published Workflow directly.

**Required Behavior:**
- Modification is rejected
- Error indicates Published Workflows are immutable
- User directed to create new Draft from version

*Source: 20_flowspec_invariants.md INV-011*

### 6.3 Concurrent Publish Attempts

**Scenario:** Two users attempt to Publish the same Validated Workflow simultaneously.

**Required Behavior:**
- First Publish succeeds
- Second Publish may succeed (creates another version) or fail if Workflow state changed
- Both versions are valid if both succeed

### 6.4 Active Flows on Old Version

**Scenario:** New version is Published while Flows are executing on old version.

**Required Behavior:**
- Existing Flows continue on their bound version
- New Flows can use either version (unless policy restricts)
- No migration or update of existing Flows

*Source: 10_flowspec_engine_contract.md §7.3*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-010 | Flow Bound to Version | Existing Flows unaffected by new versions |
| INV-011 | Published Immutable | Published Workflows cannot be modified |

---

## 8. Implementation Notes

### 8.1 State Transition Diagram

```
        ┌──────────┐
        │          │
   ┌────┤  Draft   │◄───────────────┐
   │    │          │                │
   │    └────┬─────┘                │
   │         │                      │
   │         │ Validate             │ Edit
   │         │ (passing)            │ (revert)
   │         ▼                      │
   │    ┌──────────┐                │
   │    │          │────────────────┘
   │    │ Validated│
   │    │          │
   │    └────┬─────┘
   │         │
   │         │ Publish
   │         ▼
   │    ┌──────────┐
   │    │          │
   └───►│Published │ (Terminal - no outbound transitions)
        │          │
        └──────────┘
```

### 8.2 Version Identifier

Unique, opaque string. Implementation may use:
- Sequential numbers (v1, v2, v3)
- UUIDs
- Timestamp-based identifiers

### 8.3 API Patterns

```
POST /api/flowspec/workflows/{id}/validate
→ Transitions Draft → Validated (if valid)

POST /api/flowspec/workflows/{id}/publish
→ Transitions Validated → Published

POST /api/flowspec/workflows/{id}/versions/{versionId}/branch
→ Creates new Draft from Published version

PATCH /api/flowspec/workflows/{id}
→ Only allowed if state is Draft
```

---

## 9. Acceptance Criteria

- [ ] Draft Workflows are freely editable
- [ ] Draft Workflows cannot create Flows
- [ ] Validate action transitions Draft → Validated (if validation passes)
- [ ] Validate action fails if validation has errors
- [ ] Edit action transitions Validated → Draft
- [ ] Publish action transitions Validated → Published
- [ ] Publish action requires validation to have passed
- [ ] Published Workflows cannot be modified
- [ ] Modify attempt on Published returns error
- [ ] Each Publish creates new unique version
- [ ] Previous Published versions remain unchanged
- [ ] Existing Flows continue on their bound version after new Publish
- [ ] New Draft can be created from any Published version
- [ ] Any Published version can be viewed (read-only)
- [ ] **Tenant Isolation:** API layer rejects lifecycle transitions where actor's `companyId` ≠ Workflow's `companyId`

---

## 10. Open Questions

None — canon complete.
