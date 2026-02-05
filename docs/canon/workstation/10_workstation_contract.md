# Work Station Contract

**Document ID:** 10_workstation_contract  
**Status:** CANONICAL  
**Last Updated:** 2026-02-04  
**Related Documents:**
- [00_workstation_glossary.md](./00_workstation_glossary.md)
- [10_workstation_invariants_v1.md](./10_workstation_invariants_v1.md)
- [20_workstation_invariants.md](./20_workstation_invariants.md)
- [20_workstation_manager_dashboard_contract_v1.md](./20_workstation_manager_dashboard_contract_v1.md)
- [30_workstation_ui_api_map.md](./30_workstation_ui_api_map.md)
- [FlowSpec Engine Contract](../flowspec/10_flowspec_engine_contract.md)

---

## 1. Purpose

This document defines the behavioral contract of Work Station. It specifies:
- What Work Station is
- What Work Station does
- What Work Station does NOT do
- How Work Station interacts with FlowSpec

**Rule:** All Work Station implementations MUST conform to this contract.

---

## 2. Foundational Boundary (Non-Negotiable)

> **The Work Station does not execute workflows; it exists solely to perform and submit human work (tasks) into FlowSpec.**

This statement is the canonical lock. See [FlowSpec Engine Contract §2.1](../flowspec/10_flowspec_engine_contract.md).

---

## 3. Core Statement

**Work Station IS an Execution Surface.**

Work Station provides a user interface where humans:
1. View Tasks that are ready to be worked on
2. Perform the actual work
3. Submit results (Outcomes and Evidence) to FlowSpec

**Manager View (v1):**
The primary interface for Work Station v1 is the **Manager Dashboard**. It serves as a decision-support and execution hub for operational leaders to identify and resolve system blockages.

**Worker View (Future):**
A focused, task-centric view for individual contributors is planned as a future overlay. v1 defaults to the Manager view.

---

## 4. Work Station Responsibilities

### 4.1 MUST Do

| # | Responsibility | Description |
|---|----------------|-------------|
| 4.1.1 | Query Actionable Tasks | Request current Actionable Tasks from FlowSpec |
| 4.1.2 | Render Tasks | Display Tasks in a user-friendly interface |
| 4.1.3 | Collect Evidence | Provide UI for users to upload/enter Evidence |
| 4.1.4 | Collect Outcome Selection | Provide UI for users to select an Outcome |
| 4.1.5 | Submit to FlowSpec | Send Outcomes and Evidence to FlowSpec interfaces |
| 4.1.6 | Handle Rejections | Gracefully handle FlowSpec rejection (stale state, validation failure) |
| 4.1.7 | Refresh on Change | Re-query Actionable Tasks after submissions or on user request |
| 4.1.8 | Require Authentication | Ensure user is authenticated before displaying or submitting |

### 4.2 MUST NOT Do

| # | Prohibition | Rationale |
|---|-------------|-----------|
| 4.2.1 | Compute Actionability | FlowSpec is sole authority (INV-019) |
| 4.2.2 | Display non-Actionable Tasks as workable | Creates false expectations |
| 4.2.3 | Infer Outcomes | Outcomes must be explicit (INV-002) |
| 4.2.4 | Mutate Truth directly | FlowSpec owns Truth (INV-009) |
| 4.2.5 | Trigger other domains | Domains don't trigger domains (INV-018) |
| 4.2.6 | Cache Outcomes as authoritative | Only FlowSpec is authoritative |
| 4.2.7 | Decide sequencing | Graph determines sequence (INV-012) |
| 4.2.8 | Unlock or advance work | Submit Outcomes; FlowSpec routes |

### 4.3 View Filtering (Option A)

- **Non-Gating:** Filtering by "My Assignments" is a client-side view reduction only.
- **Escape Hatch:** The UI MUST provide a prominent "Show All Tasks" button whenever a filter is active.
- **Order Preservation:** Filtering MUST preserve the canonical relative order of tasks (`flowId`, `taskId`, `iteration`).
- **Evidence:** `src/app/(app)/workstation/page.tsx` Lines 98-128.

---

## 5. Interaction Model

### 5.1 Query Flow

```
Work Station                         FlowSpec
     │                                   │
     │  GET /actionable-tasks            │
     │   (flowGroupId, userId)           │
     │ ─────────────────────────────────►│
     │                                   │
     │   { tasks: [...] }                │
     │ ◄─────────────────────────────────│
     │                                   │
     │  [Render tasks to user]           │
     │                                   │
```

### 5.2 Submission Flow

```
Work Station                         FlowSpec
     │                                   │
     │  [User completes work]            │
     │                                   │
     │  POST /attach-evidence            │
     │   (taskId, evidence)              │
     │ ─────────────────────────────────►│
     │                                   │
     │   { success }                     │
     │ ◄─────────────────────────────────│
     │                                   │
     │  POST /record-outcome             │
     │   (taskId, outcome)               │
     │ ─────────────────────────────────►│
     │                                   │
     │   { success } or { error }        │
     │ ◄─────────────────────────────────│
     │                                   │
     │  [Refresh actionable tasks]       │
     │                                   │
```

### 5.3 Rejection Handling Flow

```
Work Station                         FlowSpec
     │                                   │
     │  POST /record-outcome             │
     │   (taskId, outcome)               │
     │ ─────────────────────────────────►│
     │                                   │
     │   { error: TASK_NOT_ACTIONABLE }  │
     │ ◄─────────────────────────────────│
     │                                   │
     │  [Display error to user]          │
     │  [Refresh task list]              │
     │                                   │
```

---

## 6. Multi-Flow Task Aggregation

### 6.1 Concept

Work Station displays Tasks from multiple Flows within a Flow Group. The user sees a unified work queue; the underlying Flow structure is abstracted.

### 6.2 Rules

1. Work Station queries FlowSpec for Actionable Tasks across a Flow Group.
2. Tasks from different Flows (Sales-derived, Finance-derived, Execution-derived) may appear together.
3. Work Station does NOT filter, sort, or prioritize based on Flow origin unless instructed by user preference.
4. FlowSpec determines Actionability; Work Station only renders.

### 6.3 Task Attribution

Each Task returned by FlowSpec includes:
- Flow ID (which Flow instance)
- Workflow ID (which Workflow type)
- Task ID
- Task Name
- Allowed Outcomes
- Evidence Requirements
- (Optional) Domain hint for UI grouping

Work Station MAY use domain hints for visual grouping but MUST NOT use them for Actionability decisions.

---

## 6.4 View Semantics (Filtering vs Actionability)

This section clarifies the boundary between UI view behavior and FlowSpec Actionability.

### 6.4.1 Views MAY

| # | Permitted Behavior | Constraint |
|---|-------------------|------------|
| 6.4.1.1 | Filter displayed Tasks by `domainHint` | User preference only; does not change Actionability |
| 6.4.1.2 | Group Tasks visually by Flow, Workflow, or domain | Presentation only |
| 6.4.1.3 | Present global queue (all Tasks) or per-Flow lenses | User selects view; both show only Actionable Tasks |
| 6.4.1.4 | Sort Tasks by user preference (date, name, domain) | Sorting is visual; does not imply priority to FlowSpec |
| 6.4.1.5 | Hide/collapse groups for UI clarity | Hidden Tasks MUST still be accessible |

### 6.4.2 Views MUST NOT

| # | Prohibited Behavior | Rationale |
|---|---------------------|-----------|
| 6.4.2.1 | Alter Actionability based on view selection | Actionability is FlowSpec truth, not UI state |
| 6.4.2.2 | Infer readiness from position, grouping, or display order | INV-004: No Stage-Implied Readiness |
| 6.4.2.3 | Hide blocking conditions from user | User must understand why a Task is or isn't Actionable |
| 6.4.2.4 | Display non-Actionable Tasks as workable | Creates false expectations and wasted effort |
| 6.4.2.5 | Recompute Actionability client-side | INV-019: FlowSpec Evaluates All Actionability |
| 6.4.2.6 | Cache Actionability beyond current session | Stale cache creates incorrect state |

### 6.4.3 Actionability Source Rule

**Rule:** Actionability MUST always be sourced from FlowSpec query responses. Work Station MUST NOT:
- Infer Actionability from Task metadata
- Compute Actionability from Outcome history
- Predict Actionability based on other Tasks' states
- Override FlowSpec's Actionability determination

### 6.4.4 Stale State Handling (Expanded)

**Requirements:**
1. UI MUST handle Tasks that become non-Actionable after render.
2. UI MUST surface stale-state errors clearly (not generic failures).
3. UI MUST NOT discard user-entered Evidence due to stale state.
4. UI MUST provide clear path to recovery (refresh, retry with fresh data).
5. UI SHOULD indicate when displayed data may be stale (time since last refresh).

**Stale State Scenarios:**

| Scenario | UI Behavior |
|----------|-------------|
| Task completed by another user | Show specific error; preserve Evidence; refresh list |
| Cross-Flow Dependency satisfied | Task appears on next refresh; no error |
| Cross-Flow Dependency broken (edge case) | Task disappears on refresh; show informative message |
| Network delay causes outdated list | Refresh resolves; no data loss |

---

## 7. Edge Cases

### 7.1 Stale Derived State

**Scenario:** User views Actionable Task, but another user records an Outcome before first user submits.

**Behavior:**
1. First user attempts submission.
2. FlowSpec rejects: Task no longer Actionable (Outcome already recorded).
3. Work Station displays error: "This task has already been completed."
4. Work Station refreshes task list.

**Rule:** Work Station MUST handle rejection gracefully. Users MUST NOT lose unsaved Evidence.

### 7.2 Concurrent Users Across Domains

**Scenario:** Finance user and Work Station user both have Actionable Tasks from the same Flow Group. Both submit simultaneously.

**Behavior:**
1. Both submissions reach FlowSpec.
2. FlowSpec processes each independently.
3. If submissions are for different Tasks, both succeed.
4. If submissions are for the same Task (race condition), first succeeds, second is rejected.
5. Rejected user receives error and refreshes.

**Rule:** FlowSpec arbitrates concurrency. Work Station does not coordinate with other domains.

### 7.3 Cross-Flow Dependency Satisfaction

**Scenario:** Work Station user views task list. Task "Schedule Installation" is NOT Actionable (waiting for Finance deposit). Finance records deposit. Task becomes Actionable.

**Behavior:**
1. Work Station displays current Actionable Tasks (not including blocked task).
2. Finance records Outcome elsewhere (Finance Execution Surface or API).
3. FlowSpec updates Derived State.
4. Work Station's cached list is now stale.
5. On next refresh (manual or automatic), "Schedule Installation" appears.

**Rule:** Work Station SHOULD implement periodic refresh or push notifications. Work Station MUST NOT poll aggressively.

### 7.4 Evidence Upload Before Outcome

**Scenario:** User uploads Evidence, then network fails before Outcome submission.

**Behavior:**
1. Evidence is attached to Task (persisted in FlowSpec).
2. Outcome submission fails (network).
3. User retries Outcome submission.
4. FlowSpec accepts Outcome (Evidence already attached).

**Rule:** Evidence attachment and Outcome recording are separate operations. Work Station SHOULD submit Evidence before Outcome.

### 7.5 Retry and Idempotency

**Scenario:** Outcome submission times out. User clicks submit again.

**Behavior:**
1. First submission may have succeeded (network timeout on response).
2. Second submission reaches FlowSpec.
3. FlowSpec checks: Outcome already recorded for this Task.
4. FlowSpec returns success (idempotent) or informative error.
5. Work Station treats as success.

**Rule:** Work Station SHOULD use idempotency keys. FlowSpec enforces Outcome immutability as natural idempotency.

---

## 8. Authentication and Authorization

### 8.1 Authentication

**Rule:** Work Station MUST require authenticated session before displaying Tasks or accepting submissions.

**Implementation:** Clerk provides authentication. Work Station verifies session before all operations.

### 8.2 Authorization (Conceptual)

**Note:** Detailed role/permission systems are out-of-scope per project rules. High-level concepts only.

**Conceptual Rules:**
1. Users may only view Tasks they are authorized to work on.
2. Users may only submit Outcomes for Tasks they are authorized to complete.
3. Authorization is checked at query time (filter Actionable Tasks) and submission time (validate permission).
4. FlowSpec is the authority for authorization checks.

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Requirement | Target |
|-------------|--------|
| Task list query latency | < 500ms |
| Outcome submission latency | < 1s |
| Evidence upload | Depends on file size; progress indicator required |

### 9.2 Reliability

| Requirement | Description |
|-------------|-------------|
| Graceful degradation | If FlowSpec unavailable, show error, retain local Evidence drafts |
| Retry logic | Automatic retry with exponential backoff for transient failures |
| Data preservation | Never discard user-entered Evidence on failure |

### 9.3 Theme Support

**Requirement:** Work Station MUST support Light Mode and Dark Mode per application theming system.

**Readability Requirements:**
1. Task list items MUST be legible in both themes.
2. Task status indicators MUST be visible in both themes.
3. Error states MUST be distinguishable in both themes (not color alone).
4. Form inputs and buttons MUST meet WCAG AA contrast ratio (4.5:1 minimum).
5. Evidence attachment indicators MUST be visible in both themes.

**⚠️ Critical Boundary — Theme Semantics:**
> Theme MUST NOT encode execution semantics. Specifically:
> - Color MUST NOT indicate Actionability or readiness.
> - Light/Dark mode MUST NOT change which Tasks are displayed.
> - Theme MUST NOT affect submission behavior or validation.
>
> Theme is presentation preference only.

---

## 10. Acceptance Checklist

The following statements must be true for Work Station to be considered compliant:

### 10.1 Core Behavior

- [ ] Queries FlowSpec for Actionable Tasks
- [ ] Only displays Tasks marked Actionable by FlowSpec
- [ ] Submits Outcomes via FlowSpec interface
- [ ] Submits Evidence via FlowSpec interface
- [ ] Does NOT compute Actionability locally
- [ ] Does NOT display non-Actionable Tasks as workable

### 10.2 Multi-Flow Support

- [ ] Displays Tasks from multiple Flows in same Flow Group
- [ ] Does NOT filter by Flow origin (unless user preference)
- [ ] Attributes Tasks to originating Flow/Workflow

### 10.3 Edge Case Handling

- [ ] Handles stale state rejection gracefully
- [ ] Preserves Evidence on submission failure
- [ ] Refreshes task list after submission
- [ ] Handles concurrent user scenarios

### 10.4 Authentication

- [ ] Requires authenticated session
- [ ] Passes authentication context to FlowSpec

## 11. Manager Dashboard v1 (Primary Interface)

Work Station v1 is implemented as a high-density dashboard focused on managerial decision-making.

### 11.1 The Lens Model
- **Tabs as Lenses:** Each tab provides a unique perspective (Overview, Calendar, Jobs, Tasks, Crews, Analytics).
- **Proactive Alerts:** Each non-Overview lens surfaces tab-relevant alerts at the top (INV-WS-03).
- **URL-Driven:** Current lens state is preserved in the URL (`?lens=...`) for linkability.

### 11.2 Job Health (INV-WS-07)
- **Derived Concept:** Health is not a database model; it is computed client-side based on blocker presence.
- **Rules:**
  - **Red:** Blocking detours or overdue urgent tasks.
  - **Orange:** Risks, missing evidence, or unassigned tasks.
  - **Green:** No active risk signals.
- **Needs Decision Filter:** A derived view surfacing all jobs requiring intervention.

### 11.3 Customer Messages (Read-Only)
- **UX Boundary:** A dedicated panel in the Right Rail for customer signals.
- **Status:** **READ ONLY.**
- **Limitation:** No messaging primitives (threads/replies) exist in v1. Implementation is placeholder-only to establish the UX boundary.

### 11.4 Non-Goals (v1)
- No bidirectional messaging system.
- No real-time calendar conflict engine.
- No persistent "Alert" records (derived only).

---

**End of Document**
