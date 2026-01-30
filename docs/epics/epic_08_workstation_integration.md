# epic_08_workstation_integration.md

**Epic ID:** EPIC-08  
**Title:** Work Station Integration  
**Status:** SPECIFICATION  
**Canon Sources:** 00_workstation_glossary.md, 10_workstation_contract.md, 20_workstation_invariants.md, 30_workstation_ui_api_map.md

---

## 1. Purpose

Implement the Work Station **Execution Surface** that allows humans to view Actionable Tasks, perform work, attach Evidence, and submit Outcomes to FlowSpec. Work Station is a consumer of FlowSpec, not an executor of workflows. It exists for action, not historical lookup (which belongs to the **Job Card** Projection Surface).

### 1.1 Authorization Boundary

> **Tenant Isolation:** Work Station queries for Actionable Tasks are scoped to the actor's `companyId`. All submission endpoints require that the actor's `companyId` matches the Flow's `companyId`. Within a tenant, all authenticated members see all Actionable Tasks—there is no per-user task filtering or assignment in v2. This is an explicit non-goal.

---

## 2. In-Scope Responsibilities

- Query FlowSpec for Actionable Tasks
- Render Tasks for human interaction
- Collect Evidence from users
- Collect Outcome selection from users
- Submit Outcomes and Evidence to FlowSpec
- Handle rejections gracefully (stale state, validation failures)
- Refresh task list after submissions
- Require authentication for all operations
- Display Tasks from multiple Flows in same Flow Group

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Compute Actionability locally | FlowSpec is sole authority (WS-INV-002) |
| 3.2 | Display non-Actionable Tasks as workable | Creates false expectations (WS-INV-002) |
| 3.3 | Infer Outcomes | Outcomes must be explicit (WS-INV-010) |
| 3.4 | Mutate Truth directly | Submit via FlowSpec only (WS-INV-003, WS-INV-004) |
| 3.5 | Trigger other domains | All coordination through FlowSpec (WS-INV-005) |
| 3.6 | Decide sequencing | Graph determines sequence (10_workstation_contract.md §4.2.7) |
| 3.7 | Unlock or advance work | Submit Outcomes; FlowSpec routes (10_workstation_contract.md §4.2.8) |

---

## 4. Authoritative Requirements

### 4.1 Query Actionable Tasks

- **MUST** query FlowSpec for Actionable Tasks
  - *Source: 10_workstation_contract.md §4.1.1*
- **MUST** only display Tasks marked Actionable by FlowSpec
  - *Source: 10_workstation_contract.md §4.2.2*
- **MUST** support query by Flow Group for Multi-Flow View
  - *Source: 10_workstation_contract.md §6.1*
- **MUST NOT** filter Tasks by Flow origin based on internal logic
  - *Source: 20_workstation_invariants.md WS-INV-009*

### 4.2 Task Rendering

- **MUST** render Tasks in user-friendly interface
  - *Source: 10_workstation_contract.md §4.1.2*
- **MUST** display: Task Name, Workflow/Domain origin, status indicators
  - *Source: 30_workstation_ui_api_map.md §3.1*
- **MAY** use domainHint for visual grouping but MUST NOT use for Actionability decisions
  - *Source: 10_workstation_contract.md §6.3*
- **MUST NOT** allow domainHint to affect filtering logic or task sequencing
  - *Source: 30_workstation_ui_api_map.md §3.3*

### 4.3 Evidence Collection

- **MUST** provide UI for users to upload/enter Evidence
  - *Source: 10_workstation_contract.md §4.1.3*
- **MUST** submit Evidence to FlowSpec interfaces
  - *Source: 10_workstation_contract.md §4.1.5*
- **MUST NOT** treat local Evidence as attached until FlowSpec confirms
  - *Source: 20_workstation_invariants.md WS-INV-004*
- **MUST** preserve Evidence on submission failure
  - *Source: 20_workstation_invariants.md WS-INV-011*

### 4.4 Outcome Submission

- **MUST** provide UI for users to select an Outcome
  - *Source: 10_workstation_contract.md §4.1.4*
- **MUST** submit Outcomes via FlowSpec interface
  - *Source: 10_workstation_contract.md §4.1.5*
- **MUST NOT** record Outcomes locally as authoritative
  - *Source: 20_workstation_invariants.md WS-INV-003*
- **MUST NOT** infer or auto-select Outcomes
  - *Source: 20_workstation_invariants.md WS-INV-010*
- **MUST** submit Evidence before Outcome if Evidence required
  - *Source: 10_workstation_contract.md §7.4*

### 4.5 Rejection Handling

- **MUST** handle FlowSpec rejection gracefully
  - *Source: 10_workstation_contract.md §4.1.6*
- **MUST** preserve user-entered Evidence on rejection
  - *Source: 20_workstation_invariants.md WS-INV-006*
- **MUST NOT** crash, lose data, or display incorrect information
  - *Source: 20_workstation_invariants.md WS-INV-006*
- **MUST** show informative error messages
  - *Source: 30_workstation_ui_api_map.md §3.4*

### 4.6 Refresh Behavior

- **MUST** refresh task list after successful Outcome submission
  - *Source: 20_workstation_invariants.md WS-INV-007*
- **MAY** implement periodic refresh or push notifications
  - *Source: 10_workstation_contract.md §7.3*
- **MUST NOT** poll more frequently than once per 10 seconds
  - *Source: 30_workstation_ui_api_map.md §7.1*

### 4.7 Authentication

- **MUST** require authenticated session for all operations
  - *Source: 20_workstation_invariants.md WS-INV-008*
- Unauthenticated access **MUST** be denied
  - *Source: 20_workstation_invariants.md WS-INV-008*
- **MUST** pass authentication context to FlowSpec
  - *Source: 10_workstation_contract.md §8.1*

### 4.8 Idempotency

- **MUST** handle submission retries safely
  - *Source: 20_workstation_invariants.md WS-INV-012*
- **SHOULD** use idempotency keys for Evidence uploads
  - *Source: 10_workstation_contract.md §7.5*
- Duplicate submissions **MUST NOT** cause errors or duplicate records
  - *Source: 20_workstation_invariants.md WS-INV-012*

---

## 5. System Boundaries & Ownership

| Owned by Work Station | Delegated to FlowSpec |
|----------------------|----------------------|
| Task rendering UI | Actionability computation |
| Evidence upload UI | Outcome recording |
| Outcome selection UI | Evidence attachment |
| Error display | Truth storage |
| Local Evidence drafts (temp) | Gate routing |
| Authentication context passing | Authorization enforcement |

---

## 6. Edge Cases & Failure Modes

### 6.1 Stale Derived State

**Scenario:** User views Task, another user completes it before first user submits.

**Required Behavior:**
- First user's submission is rejected (Task no longer Actionable)
- Error: "This task has already been completed."
- Evidence preserved
- Task list refreshed

*Source: 10_workstation_contract.md §7.1*

### 6.2 Concurrent Users Across Domains

**Scenario:** Finance user and Work Station user both submit simultaneously.

**Required Behavior:**
- If different Tasks: both succeed
- If same Task: first succeeds, second rejected
- FlowSpec arbitrates concurrency
- Work Station does not coordinate with other domains

*Source: 10_workstation_contract.md §7.2*

### 6.3 Cross-Flow Dependency Satisfaction

**Scenario:** Blocked Task becomes Actionable due to Outcome in another Flow.

**Required Behavior:**
- On next refresh, Task appears in list
- Work Station SHOULD refresh periodically or use push notifications
- Task appears without manual page refresh (via auto-refresh mechanism)

*Source: 10_workstation_contract.md §7.3*

### 6.4 Network Failure During Submission

**Scenario:** Evidence uploaded, network fails before Outcome submission.

**Required Behavior:**
- Evidence already attached (persisted in FlowSpec)
- User retries Outcome submission
- Outcome submission succeeds

*Source: 10_workstation_contract.md §7.4*

### 6.5 Retry After Timeout

**Scenario:** Outcome submission times out. User clicks submit again.

**Required Behavior:**
- If first succeeded: second treated as idempotent success
- If first failed: second processed normally
- No duplicate Outcomes, no errors shown

*Source: 10_workstation_contract.md §7.5*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| WS-INV-001 | Not a Workflow Engine | Work Station only renders and submits |
| WS-INV-002 | Actionability from FlowSpec Only | No local computation |
| WS-INV-003 | Outcomes Submitted Not Local | Submit to FlowSpec only |
| WS-INV-004 | Evidence Submitted Not Local | Submit to FlowSpec only |
| WS-INV-005 | No Domain Triggering | All coordination via FlowSpec |
| WS-INV-006 | Graceful Stale Handling | Preserve data on rejection |
| WS-INV-007 | Refresh After Submission | Auto-refresh task list |
| WS-INV-008 | Authentication Required | All operations require auth |
| WS-INV-009 | No Local Flow Filtering | Display all Actionable Tasks |
| WS-INV-010 | No Outcome Inference | Explicit user selection only |
| WS-INV-011 | Evidence Preservation | Don't lose user data on failure |
| WS-INV-012 | Idempotent Submission | Safe retries |

---

## 8. Implementation Notes

### 8.1 Required FlowSpec API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/flowspec/actionable-tasks` | GET | List all Actionable Tasks for user |
| `/api/flowspec/flow-groups/{id}/actionable-tasks` | GET | List Actionable Tasks in Flow Group |
| `/api/flowspec/flows/{flowId}/tasks/{taskId}` | GET | Get Task detail |
| `/api/flowspec/flows/{flowId}/tasks/{taskId}/evidence` | GET | Get attached Evidence |
| `/api/flowspec/flows/{flowId}/tasks/{taskId}/evidence` | POST | Attach Evidence |
| `/api/flowspec/flows/{flowId}/tasks/{taskId}/outcome` | POST | Record Outcome |

*Source: 30_workstation_ui_api_map.md §4*

### 8.2 Task Object Shape

```json
{
  "taskId": "string",
  "taskName": "string",
  "flowId": "string",
  "flowGroupId": "string",
  "workflowId": "string",
  "workflowName": "string",
  "nodeId": "string",
  "nodeName": "string",
  "allowedOutcomes": ["OUTCOME_A", "OUTCOME_B"],
  "evidenceRequired": true,
  "evidenceSchema": {},
  "domainHint": "execution | finance | sales",
  "startedAt": "timestamp | null",
  "instructions": "string | null"
}
```

*Source: 30_workstation_ui_api_map.md §2.1*

### 8.3 Error Message Mapping

| Error Code | User Message |
|------------|--------------|
| TASK_NOT_ACTIONABLE | "This task has already been completed or is no longer available. Refreshing your task list." |
| INVALID_OUTCOME | "Invalid selection. Please choose from the available options." |
| EVIDENCE_REQUIRED | "Please attach the required evidence before submitting." |
| UNAUTHORIZED | "You are not authorized to complete this task." |
| Network Error | "Unable to connect. Your work has been saved locally. Please try again." |

*Source: 30_workstation_ui_api_map.md §3.4*

### 8.4 Forbidden Operations

- Any route that mutates Flow structure
- Any route that creates Flows
- Direct database access to FlowSpec tables
- Routes in Sales, Finance, or Admin domains for workflow purposes
- Any route that computes Actionability

*Source: 30_workstation_ui_api_map.md §5*

---

## 9. Acceptance Criteria

- [ ] Work Station queries FlowSpec for Actionable Tasks
- [ ] Only Tasks marked Actionable by FlowSpec are displayed
- [ ] Tasks from multiple Flows in Flow Group are displayed together
- [ ] domainHint is used for visual grouping only, not filtering
- [ ] Evidence can be uploaded to Tasks
- [ ] Evidence is submitted to FlowSpec, not stored locally as authoritative
- [ ] Outcomes can be selected from allowed list
- [ ] Outcomes are submitted to FlowSpec, not recorded locally
- [ ] No Outcome is inferred or auto-selected
- [ ] Stale state rejection is handled gracefully
- [ ] Evidence is preserved on submission failure
- [ ] Informative error messages are displayed
- [ ] Task list refreshes after successful submission
- [ ] All operations require authentication
- [ ] Unauthenticated access is denied
- [ ] Duplicate submissions are handled idempotently
- [ ] No domain-to-domain calls for workflow operations
- [ ] **Tenant Isolation:** Actionable Task queries return only tasks from actor's `companyId`
- [ ] **Tenant Isolation:** Submissions rejected where actor's `companyId` ≠ Flow's `companyId`
- [ ] **Tenant Isolation:** No per-user task filtering within tenant (all members see all tenant tasks)

#### Drift Protection (M3 Guards Required)

- [ ] `guard_flowspec_workstation_boundary.mjs` passes (Work Station cannot import `src/lib/flowspec/engine.ts`, `derived.ts`, or `truth.ts`)

---

## 10. Open Questions

None — canon complete.
