# epic_03_flowspec_flow_instantiation.md

**Epic ID:** EPIC-03  
**Title:** FlowSpec Flow Instantiation  
**Status:** SPECIFICATION  
**Canon Sources:** 00_flowspec_glossary.md, 10_flowspec_engine_contract.md, 20_flowspec_invariants.md

---

## 1. Purpose

Implement the Flow instantiation system that creates live execution instances from Published Workflows, binds them to specific Workflow versions, manages Flow Groups via Scope, handles fan-out patterns, and activates Entry Nodes to begin execution. The `scope` parameter serves as the metadata bridge between the **Truth Store** (FlowSpec) and **Projection Surfaces** (like Jobs).

### 1.1 Authorization Boundary

> **Tenant Isolation:** Flow creation requires that the actor's `companyId` matches the Workflow's `companyId`. The API layer validates this before invoking instantiation logic. The instantiation system does NOT perform authorization—it trusts upstream validation.

---

## 2. In-Scope Responsibilities

- Create Flow instances from Published Workflows
- Bind Flow permanently to Workflow version at creation
- Manage Flow Group membership via Scope
- Enforce Scope → Flow Group 1:1 relationship
- Activate Entry Node(s) when Flow is created
- Handle fan-out: instantiate multiple Flows from single Outcome
- Resolve fan-out targets to Latest Published version
- Handle fan-out failures without invalidating triggering Outcome

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Create Flows from Draft or Validated Workflows | Only Published Workflows are executable |
| 3.2 | Version pinning in fan-out rules | Not supported in v1 (10_flowspec_engine_contract.md §10.3.1) |
| 3.3 | Flow Group execution logic | Flow Group groups Flows; does not control them |
| 3.4 | Change Flow's bound Workflow version | Binding is permanent (INV-010) |

---

## 4. Authoritative Requirements

### 4.1 Flow Creation

- **MUST** create Flow only from Published Workflow
  - *Source: 10_flowspec_engine_contract.md §4.2*
- **MUST** bind Flow to specific Workflow version at creation time
  - *Source: 10_flowspec_engine_contract.md §7.3*
- **MUST NOT** allow Flow's bound Workflow version to change
  - *Source: 20_flowspec_invariants.md INV-010*
- **MUST** activate Entry Node(s) when Flow is created
  - *Source: 10_flowspec_engine_contract.md §4.2*
- **MUST** record NodeActivated event for Entry Node(s)
  - *Source: 10_flowspec_engine_contract.md §5.2.1*

### 4.2 Scope and Flow Group

- **MUST** require scope parameter with type and id for Flow creation
  - *Source: 00_flowspec_glossary.md §2.3.3*
- **MUST** enforce Scope → Flow Group 1:1 relationship
  - *Source: 00_flowspec_glossary.md §2.3.3*
- **MUST** create Flow Group when first Flow for a Scope is instantiated
  - *Source: 10_flowspec_engine_contract.md §10.1*
- **MUST** verify flowGroupId matches existing Flow Group for Scope if provided
  - *Source: 00_flowspec_glossary.md §2.3.3*
- **MUST** reject request if flowGroupId does not match Scope's Flow Group
  - *Source: 00_flowspec_glossary.md §2.3.3*

### 4.3 Scope Shape

```
{
  type: string,   // e.g., "job", "project", "engagement"
  id: string      // unique identifier within the type
}
```
*Source: 00_flowspec_glossary.md §2.3.3*

### 4.4 Flow Group Semantics

- **MUST NOT** allow Flow Group to become a parent workflow or super-state machine
  - *Source: 00_flowspec_glossary.md §2.3.2*
- **MUST NOT** allow Flow Group to imply ordering between member Flows
  - *Source: 00_flowspec_glossary.md §2.3.2*
- **MUST NOT** allow Flow Group to contain execution logic, routing rules, or lifecycle states
  - *Source: 00_flowspec_glossary.md §2.3.2*
- Flow Group groups Flows; it does not control them
  - *Source: 00_flowspec_glossary.md §2.3.2*

### 4.5 Fan-Out

- **MUST** resolve fan-out target to Latest Published version at evaluation time
  - *Source: 10_flowspec_engine_contract.md §10.3.1*
- **MUST NOT** support version pinning in fan-out rules (v1)
  - *Source: 10_flowspec_engine_contract.md §10.3.1*
- **MUST** fail fan-out for target if no Published version exists (log error)
  - *Source: 10_flowspec_engine_contract.md §10.3.1*
- **MUST** preserve Outcome recording even if fan-out instantiation fails (Truth is not rolled back)
  - *Source: 10_flowspec_engine_contract.md §10.3.2*
- **MUST** log fan-out failure with sufficient context (triggering Flow, Outcome, target Workflow, error reason)
  - *Source: 10_flowspec_engine_contract.md §10.3.2*
- **MUST** set triggering Flow to BLOCKED state on fan-out failure
  - *Source: 10_flowspec_engine_contract.md §10.3.2*
- **MUST NOT** implement automatic or manual retry mechanisms (v2 deferral)
  - *Source: 10_flowspec_engine_contract.md §10.3.2*

### 4.6 Actionability at Flow Start

- **MUST NOT** automatically make all Entry Node Tasks Actionable
  - *Source: 20_flowspec_invariants.md INV-020*
- **MUST** compute Actionability considering all constraints including Cross-Flow Dependencies
  - *Source: 20_flowspec_invariants.md INV-020*

---

## 5. System Boundaries & Ownership

| Owned by Flow Instantiation | Delegated to Other Systems |
|----------------------------|---------------------------|
| Flow creation from Published Workflow | Workflow publishing (Lifecycle epic) |
| Version binding | Actionability computation (Engine Core epic) |
| Scope → Flow Group mapping | Cross-Flow Dependency evaluation |
| Entry Node activation | |
| Fan-out execution and failure handling | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Fan-Out Target Has No Published Version

**Scenario:** Fan-out rule triggers but target Workflow has no Published version.

**Required Behavior:**
- Outcome recording succeeds
- Fan-out for that specific target fails
- Error logged with: triggering Flow, Outcome, target Workflow, error reason
- Other fan-out targets (if any) proceed independently

*Source: 10_flowspec_engine_contract.md §10.3.1, §10.3.2*

### 6.2 Partial Fan-Out Success

**Scenario:** Fan-out triggers 3 Workflows; 2 succeed, 1 fails.

**Required Behavior:**
- Outcome recording succeeds
- 2 Flows are created successfully
- 1 failure is logged with retry context
- Triggering Flow proceeds normally

### 6.3 Scope Mismatch

**Scenario:** Request provides flowGroupId that doesn't match the existing Flow Group for the given Scope.

**Required Behavior:**
- Request is rejected
- Error indicates Scope/Flow Group mismatch
- No Flow is created

*Source: 00_flowspec_glossary.md §2.3.3*

### 6.4 Flow Start with Unsatisfied Cross-Flow Dependencies

**Scenario:** Flow created with Entry Node Task that has Cross-Flow Dependency.

**Required Behavior:**
- Flow is created
- Entry Node is activated
- Task is NOT Actionable (dependency unsatisfied)
- Task becomes Actionable when dependency is satisfied

*Source: 20_flowspec_invariants.md INV-020*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-010 | Flow Bound to Version | Flow permanently bound to Workflow version |
| INV-011 | Published Immutable | Only Published Workflows can create Flows |
| INV-020 | Flow Start ≠ Actionability | Starting Flow doesn't auto-make Tasks Actionable |
| INV-021 | Cross-Flow Scoped to Flow Group | Dependencies within Flow Group only |
| INV-023 | Fan-Out Failure ≠ Outcome Rollback | Outcome survives fan-out failure |

---

## 8. Implementation Notes

### 8.1 Flow Creation Request Shape

```json
{
  "workflowId": "string",
  "scope": {
    "type": "job",
    "id": "job-12345"
  },
  "flowGroupId": "string (optional hint)"
}
```

### 8.2 Flow Creation Response Shape

```json
{
  "flowId": "string",
  "flowGroupId": "string",
  "workflowId": "string",
  "workflowVersion": "string",
  "createdAt": "timestamp"
}
```

### 8.3 Fan-Out Rule Authored in Builder

Fan-out rules are user-defined in the Workflow specification via Builder. Example:
- On Outcome SIGNED from Task S3.1 → Instantiate Finance Flow AND Execution Flow

*Source: 10_flowspec_engine_contract.md §10.3*

### 8.4 Fan-Out Failure Log Context

```json
{
  "event": "fan_out_failure",
  "triggeringFlowId": "string",
  "triggeringTaskId": "string",
  "triggeringOutcome": "string",
  "targetWorkflowId": "string",
  "errorReason": "NO_PUBLISHED_VERSION",
  "timestamp": "ISO 8601",
  "flowStatus": "BLOCKED"
}
```

**Note:** Retry mechanism is explicitly deferred in v2. The `flowStatus: BLOCKED` indicates the parent Flow is terminal until external resolution.

---

## 9. Acceptance Criteria

- [ ] Flow can only be created from Published Workflow
- [ ] Flow is bound to specific Workflow version at creation
- [ ] Flow's Workflow version cannot be changed after creation
- [ ] Scope parameter is required with type and id
- [ ] Flow Group is created for new Scope
- [ ] Existing Flow Group is reused for known Scope
- [ ] flowGroupId hint is validated against Scope
- [ ] Request rejected if flowGroupId doesn't match Scope
- [ ] Entry Node(s) are activated on Flow creation
- [ ] NodeActivated event is recorded for Entry Node(s)
- [ ] Entry Node Tasks with Cross-Flow Dependencies are not automatically Actionable
- [ ] Fan-out resolves to Latest Published version
- [ ] Fan-out failure is logged with context (triggering Flow, Outcome, target Workflow, error reason)
- [ ] Fan-out failure preserves recorded Outcome (no rollback)
- [ ] Fan-out failure sets triggering Flow to BLOCKED state
- [ ] No automatic or manual retry mechanism exists (v2 deferral)
- [ ] **Tenant Isolation:** API layer rejects Flow creation where actor's `companyId` ≠ Workflow's `companyId`

#### Drift Protection

- [ ] `guard_flowspec_schema_constraints.mjs` passes (`FlowStatus` includes `BLOCKED`, `FanOutRule` has no `targetVersion`, `FanOutFailure` has no `retriedAt`/`retryCount`)

---

## 10. Open Questions

None — canon complete.
