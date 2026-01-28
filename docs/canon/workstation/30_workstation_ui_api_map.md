# Work Station UI/API Map

**Document ID:** 30_workstation_ui_api_map  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [10_workstation_contract.md](./10_workstation_contract.md)
- [20_workstation_invariants.md](./20_workstation_invariants.md)
- [FlowSpec Builder UI/API Map](../flowspec/50_flowspec_builder_ui_api_map.md)

---

## 1. Purpose

This document maps Work Station features to their UI concepts and API interactions. It serves as a reference for implementation.

**Note:** This document does NOT define UI layout, wireframes, or visual design. It defines functional mapping only.

**IMPORTANT:** API routes marked `PLACEHOLDER:` do not exist yet. They indicate required routes that must be implemented.

---

## 2. Feature-to-API Map

### 2.1 Task List (Actionable Tasks)

| Feature | Description | API Route | Method | Request | Response |
|---------|-------------|-----------|--------|---------|----------|
| Get Actionable Tasks | Fetch all Actionable Tasks for current user in a Flow Group | `PLACEHOLDER:/api/flowspec/flow-groups/{flowGroupId}/actionable-tasks` | GET | `{ userId? }` | `{ tasks: [...] }` |
| Get Actionable Tasks (All) | Fetch all Actionable Tasks for current user across all their Flow Groups | `PLACEHOLDER:/api/flowspec/actionable-tasks` | GET | `{ userId? }` | `{ tasks: [...] }` |

**Response Task Object (Conceptual):**

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
  "evidenceSchema": { },
  "domainHint": "execution | finance | sales",
  "startedAt": "timestamp | null",
  "instructions": "string | null"
}
```

### 2.2 Task Detail

| Feature | Description | API Route | Method | Request | Response |
|---------|-------------|-----------|--------|---------|----------|
| Get Task Detail | Fetch detailed information about a specific Task | `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}` | GET | `{}` | `{ task }` |
| Get Attached Evidence | Fetch Evidence already attached to a Task | `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/evidence` | GET | `{}` | `{ evidence: [...] }` |

### 2.3 Evidence Attachment

| Feature | Description | API Route | Method | Request | Response |
|---------|-------------|-----------|--------|---------|----------|
| Attach Evidence | Upload and attach Evidence to a Task | `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/evidence` | POST | `{ type, data, idempotencyKey? }` | `{ evidenceId, success }` |

**Request Body (Conceptual):**

```json
{
  "type": "file | text | structured",
  "data": "base64 | string | object",
  "filename": "string (if file)",
  "mimeType": "string (if file)",
  "idempotencyKey": "string (optional, for retry safety)"
}
```

**Validation:**
- Task must be Actionable
- Evidence must conform to Task's Evidence Schema
- User must be authorized

### 2.4 Outcome Recording

| Feature | Description | API Route | Method | Request | Response |
|---------|-------------|-----------|--------|---------|----------|
| Record Outcome | Submit an Outcome for a Task | `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/outcome` | POST | `{ outcome, idempotencyKey? }` | `{ success } or { error }` |

**Request Body (Conceptual):**

```json
{
  "outcome": "OUTCOME_VALUE",
  "idempotencyKey": "string (optional, for retry safety)"
}
```

**Validation:**
- Task must be Actionable
- Outcome must be in Task's allowed Outcomes
- Evidence Requirements must be satisfied (if any)
- User must be authorized

**Error Responses:**

| Error Code | Description |
|------------|-------------|
| `TASK_NOT_ACTIONABLE` | Task is no longer Actionable (stale state) |
| `INVALID_OUTCOME` | Outcome not in allowed list |
| `EVIDENCE_REQUIRED` | Evidence Requirements not satisfied |
| `ALREADY_RECORDED` | Outcome already recorded (idempotent success or error) |
| `UNAUTHORIZED` | User not authorized for this Task |

### 2.5 Task Start (Optional)

| Feature | Description | API Route | Method | Request | Response |
|---------|-------------|-----------|--------|---------|----------|
| Start Task | Mark a Task as started (optional explicit start) | `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/start` | POST | `{}` | `{ success }` |

**Note:** Explicit Task start may be optional depending on implementation. Some systems auto-start on first Evidence attachment or Outcome recording.

---

## 3. UI Functional Concepts

This section describes functional UI concepts without specifying layout or design.

### 3.1 Task List View

**Purpose:** Display all Actionable Tasks for the user.

**Functional Requirements:**
1. Query FlowSpec for Actionable Tasks
2. Display Task Name, Workflow/Domain origin, and status indicators
3. Allow user to select a Task for detail view
4. Support filtering by Flow Group (if multiple)
5. Support user preference-based sorting (not Actionability-based sorting)
6. Auto-refresh or manual refresh capability

**Data Flow:**
```
[Page Load] → GET /actionable-tasks → [Render List]
[User Refresh] → GET /actionable-tasks → [Update List]
[Outcome Submitted] → GET /actionable-tasks → [Update List]
```

### 3.2 Task Detail View

**Purpose:** Display Task details and provide interface for Evidence and Outcome submission.

**Functional Requirements:**
1. Display Task Name, Instructions, Evidence Requirements
2. Display allowed Outcomes as selectable options
3. Provide Evidence upload/entry form
4. Show already-attached Evidence
5. Submit Evidence to FlowSpec
6. Submit Outcome to FlowSpec
7. Handle errors gracefully (preserve data, show message)
8. Navigate back to Task List after successful submission

**Data Flow:**
```
[Select Task] → GET /tasks/{taskId} → [Render Detail]
[Upload Evidence] → POST /evidence → [Update Evidence List]
[Select Outcome] → POST /outcome → [Handle Response] → [Refresh List / Navigate]
```

### 3.3 Multi-Flow Grouping (Optional)

**Purpose:** Visually group Tasks by Flow or Domain origin.

**Functional Requirements:**
1. Use `domainHint` or `workflowName` from Task data
2. Group Tasks in UI (collapsible sections, tabs, or badges)
3. Do NOT filter out Tasks based on grouping
4. Respect user preferences for grouping display

**⚠️ Critical Boundary — domainHint:**
> `domainHint` is UI metadata only. It exists for visual grouping and display purposes. If `domainHint` ever affects Actionability computation, filtering logic, task sequencing, or any execution behavior, the boundary between UI and engine has been violated. This field MUST remain inert to execution.

### 3.4 Error Handling UI

**Functional Requirements:**
1. Display clear error messages for FlowSpec rejections
2. Preserve form data on error
3. Provide retry option
4. Provide refresh option to update stale data

**Error Message Mapping:**

| Error Code | User Message (Example) |
|------------|----------------------|
| `TASK_NOT_ACTIONABLE` | "This task has already been completed or is no longer available. Refreshing your task list." |
| `INVALID_OUTCOME` | "Invalid selection. Please choose from the available options." |
| `EVIDENCE_REQUIRED` | "Please attach the required evidence before submitting." |
| `UNAUTHORIZED` | "You are not authorized to complete this task." |
| Network Error | "Unable to connect. Your work has been saved locally. Please try again." |

---

## 4. Required FlowSpec API Routes (Summary)

Work Station requires the following FlowSpec routes to function:

| Route | Method | Purpose | Priority |
|-------|--------|---------|----------|
| `PLACEHOLDER:/api/flowspec/actionable-tasks` | GET | List all Actionable Tasks for user | Required |
| `PLACEHOLDER:/api/flowspec/flow-groups/{id}/actionable-tasks` | GET | List Actionable Tasks in Flow Group | Required |
| `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}` | GET | Get Task detail | Required |
| `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/evidence` | GET | Get attached Evidence | Required |
| `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/evidence` | POST | Attach Evidence | Required |
| `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/outcome` | POST | Record Outcome | Required |
| `PLACEHOLDER:/api/flowspec/flows/{flowId}/tasks/{taskId}/start` | POST | Start Task | Optional |

---

## 5. Forbidden Operations

Work Station MUST NOT call or implement:

| Forbidden Operation | Reason |
|---------------------|--------|
| Any route that mutates Flow structure | Work Station submits work, doesn't define it |
| Any route that creates Flows | Domain initiators create Flows, not Work Station |
| Direct database access to FlowSpec tables | All access via API |
| Routes in Sales, Finance, or Admin domains for workflow purposes | Domains don't trigger domains |
| Any route that computes Actionability | FlowSpec computes Actionability |

---

## 6. Authentication Context

All Work Station API calls MUST include authentication context.

**Headers (Conceptual):**
```
Authorization: Bearer <session_token>
X-User-Id: <user_id> (if not in token)
```

**FlowSpec validates:**
1. Session is valid (via Clerk)
2. User is authorized for the requested operation
3. User is authorized for the specific Task (if applicable)

---

## 7. Polling and Real-Time Considerations

### 7.1 Polling (Simple Implementation)

**Rules:**
1. Work Station MAY poll for Actionable Tasks at a reasonable interval (e.g., 30 seconds).
2. Work Station MUST NOT poll more frequently than once per 10 seconds.
3. Work Station SHOULD refresh immediately after Outcome submission.

### 7.2 Real-Time (Advanced Implementation)

**Conceptual:**
1. FlowSpec MAY expose WebSocket or Server-Sent Events for Actionability changes.
2. Work Station MAY subscribe to changes for relevant Flow Groups.
3. On change event, Work Station refreshes task list.

**Note:** Real-time implementation is optional enhancement, not required for initial compliance.

---

## 8. Idempotency Keys

### 8.1 Purpose

Idempotency keys prevent duplicate operations when network issues cause retries.

### 8.2 Usage

**Evidence Attachment:**
```json
{
  "idempotencyKey": "ws-evidence-{taskId}-{timestamp}-{random}",
  ...
}
```

**Outcome Recording:**
```json
{
  "idempotencyKey": "ws-outcome-{taskId}-{timestamp}-{random}",
  ...
}
```

### 8.3 FlowSpec Behavior

- If idempotency key has been seen and operation succeeded: return success (idempotent).
- If idempotency key has been seen and operation failed: allow retry.
- If idempotency key is new: process normally.

---

## 9. Permissions (High-Level)

**Note:** Detailed role/permission systems are out-of-scope. High-level concepts only.

| Permission | Description |
|------------|-------------|
| View Tasks | User can see Actionable Tasks assigned to them |
| Complete Tasks | User can submit Outcomes for Tasks assigned to them |
| Attach Evidence | User can upload Evidence to Tasks assigned to them |

**Rule:** FlowSpec enforces permissions. Work Station passes authentication context; FlowSpec decides access.

---

**End of Document**
