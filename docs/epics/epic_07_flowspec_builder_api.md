# epic_07_flowspec_builder_api.md

**Epic ID:** EPIC-07  
**Title:** FlowSpec Builder API  
**Status:** SPECIFICATION  
**Canon Sources:** 40_flowspec_builder_contract.md, 50_flowspec_builder_ui_api_map.md

---

## 1. Purpose

Implement the API layer that supports the FlowSpec Builder UI. This includes CRUD operations for Workflows, Nodes, Tasks, Outcomes, and Gates, as well as lifecycle operations (Validate, Publish) and versioning endpoints.

### 1.1 Authorization Boundary

> **Tenant Isolation:** All Builder API routes require that the actor's `companyId` matches the resource's `companyId`. For creation endpoints, new resources inherit the actor's `companyId`. For read/update/delete endpoints, the API layer validates tenant ownership before processing. List endpoints return only resources where `companyId` matches the actor's tenant. This is the sole authorization check—there is no per-user or per-role restriction within a tenant.

---

## 2. In-Scope Responsibilities

- Workflow CRUD (Create, Read, Update, Delete)
- Node CRUD within Workflows
- Task CRUD within Nodes
- Outcome CRUD within Tasks
- Gate (routing) CRUD
- Evidence Requirements configuration
- Validation endpoint
- Publish endpoint
- Version management endpoints
- UI/API parity (all UI features accessible via API)

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Builder UI implementation | UI is separate from API (40_flowspec_builder_contract.md §3.3) |
| 3.2 | Flow execution endpoints | Execution is separate epic (Engine Core) |
| 3.3 | Work Station endpoints | Separate epic (Work Station Integration) |
| 3.4 | Forbidden routes (Outcome mutation, Published mutation) | Violates invariants |

---

## 4. Authoritative Requirements

### 4.1 Workflow Management

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows` | POST | Create Workflow | Name required, unique |
| `/api/flowspec/workflows` | GET | List Workflows | None |
| `/api/flowspec/workflows/{id}` | GET | Get Workflow | Workflow exists |
| `/api/flowspec/workflows/{id}` | PATCH | Update Workflow | Name unique, Workflow is Draft |
| `/api/flowspec/workflows/{id}` | DELETE | Delete Workflow | Not Published (or all versions deleted) |

*Source: 50_flowspec_builder_ui_api_map.md §2.1*

### 4.2 Node Management

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/nodes` | POST | Create Node | Name unique in Workflow, Workflow is Draft |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}` | PATCH | Update Node | Name unique, valid completion rule |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}` | DELETE | Delete Node | Workflow is Draft |

*Source: 50_flowspec_builder_ui_api_map.md §2.2*

### 4.3 Task Management

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks` | POST | Create Task | Name unique in Node |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` | PATCH | Update Task | Name unique in Node |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` | DELETE | Delete Task | Warn if Outcomes have routes |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/reorder` | PATCH | Reorder Tasks | All Task IDs valid |

*Source: 50_flowspec_builder_ui_api_map.md §2.3*

### 4.4 Outcome Management

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes` | POST | Add Outcome | Name unique in Task |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes/{outcomeId}` | PATCH | Update Outcome | Name unique in Task |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes/{outcomeId}` | DELETE | Delete Outcome | Route must be deleted first (or cascade) |

*Source: 50_flowspec_builder_ui_api_map.md §2.4*

### 4.5 Gate (Routing) Management

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/gates` | POST | Create Gate/route | All IDs valid, no duplicate route |
| `/api/flowspec/workflows/{id}/gates/{gateId}` | PATCH | Update Gate | Target exists |
| `/api/flowspec/workflows/{id}/gates/{gateId}` | DELETE | Delete Gate | Creates orphan warning |

*Source: 50_flowspec_builder_ui_api_map.md §2.5*

**Gate Key Rule:**
- Gates use `sourceNodeId` (not `sourceTaskId`) — this is canonical
  - *Source: 10_flowspec_engine_contract.md §5.5.2.1*

### 4.6 Evidence Requirements

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` | PATCH | Set Evidence Required | None |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/evidence-schema` | PUT | Configure Evidence Schema | Valid JSON schema |

*Source: 50_flowspec_builder_ui_api_map.md §2.6*

### 4.7 Cross-Flow Dependencies

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/cross-flow-dependencies` | POST | Add Cross-Flow Dependency | Source Workflow Published, Task exists, Outcome valid |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/cross-flow-dependencies` | GET | List Cross-Flow Dependencies | None |
| `/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/cross-flow-dependencies/{depId}` | DELETE | Delete Cross-Flow Dependency | Workflow is Draft |

*Source: 50_flowspec_builder_ui_api_map.md §2.7*

**Request Shape:**
```json
{
  "sourceWorkflowId": "string",
  "sourceTaskPath": "string",
  "requiredOutcome": "string"
}
```

**Publish-Time Validation:**
- Source Workflow must exist and be Published
- Source Task must exist in Source Workflow
- Required Outcome must be defined on Source Task
- Circular dependencies are flagged as errors

### 4.8 Fan-Out Rules

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/fan-out-rules` | POST | Add Fan-Out Rule | Target Workflow Published, Outcome valid |
| `/api/flowspec/workflows/{id}/fan-out-rules` | GET | List Fan-Out Rules | None |
| `/api/flowspec/workflows/{id}/fan-out-rules/{ruleId}` | DELETE | Delete Fan-Out Rule | Workflow is Draft |

*Source: 50_flowspec_builder_ui_api_map.md §2.8*

**Request Shape:**
```json
{
  "sourceNodeId": "string",
  "triggerOutcome": "string",
  "targetWorkflowId": "string"
}
```

**Publish-Time Validation:**
- Target Workflow must exist and be Published
- Trigger Outcome must be valid in Source Node
- No unbounded fan-out patterns

**Runtime Behavior (v2):**
- Fan-out resolves to Latest Published version
- Fan-out failure BLOCKS parent Flow (no retry in v2)

### 4.9 Lifecycle Endpoints

| Route | Method | Purpose | Validation |
|-------|--------|---------|------------|
| `/api/flowspec/workflows/{id}/validate` | POST | Validate Workflow | Workflow is Draft |
| `/api/flowspec/workflows/{id}/publish` | POST | Publish Workflow | Workflow is Validated |
| `/api/flowspec/workflows/{id}/versions` | GET | List Versions | None |
| `/api/flowspec/workflows/{id}/versions/{versionId}` | GET | Get Specific Version | Version exists |
| `/api/flowspec/workflows/{id}/versions/{versionId}/branch` | POST | Create Draft from Version | Version exists |

*Source: 50_flowspec_builder_ui_api_map.md §2.9*

### 4.10 Forbidden Routes

The following routes **MUST NOT** be implemented:

| Forbidden Route | Reason | Invariant |
|-----------------|--------|-----------|
| `PATCH /flows/{id}/tasks/{taskId}/outcome` | Mutating recorded Outcome | INV-007 |
| `DELETE /flows/{id}/tasks/{taskId}/outcome` | Deleting recorded Outcome | INV-007 |
| `DELETE /flows/{id}/evidence/{evidenceId}` | Deleting attached Evidence | Append-only |
| `PATCH /workflows/{id}/versions/{versionId}` | Mutating Published version | INV-011 |
| `PATCH /flows/{id}/workflowVersion` | Changing Flow's bound version | INV-010 |

*Source: 50_flowspec_builder_ui_api_map.md §4*

### 4.11 API Design Rules

- All requests require authenticated session
  - *Source: 50_flowspec_builder_ui_api_map.md §6.1.1*
- All responses include timestamp
  - *Source: 50_flowspec_builder_ui_api_map.md §6.1.2*
- Error responses include code, message, details
  - *Source: 50_flowspec_builder_ui_api_map.md §6.1.3*
- List responses include pagination (limit, offset, total)
  - *Source: 50_flowspec_builder_ui_api_map.md §6.1.4*
- All IDs are opaque strings (no sequential integers exposed)
  - *Source: 50_flowspec_builder_ui_api_map.md §6.1.5*
- All routes MUST include `export const dynamic = "force-dynamic"`
  - *Source: 50_flowspec_builder_ui_api_map.md §6.3*

### 4.10 UI/API Parity

**MUST** ensure every feature accessible in UI is also accessible via API, and vice versa.

*Source: 40_flowspec_builder_contract.md §10.1*

---

## 5. System Boundaries & Ownership

| Owned by Builder API | Delegated to Other Systems |
|---------------------|---------------------------|
| Workflow CRUD | UI rendering (Builder UI) |
| Node/Task/Outcome/Gate CRUD | Validation logic (Validation epic) |
| Lifecycle state transitions | Execution (Engine Core epic) |
| Versioning | Authentication (Clerk) |

---

## 6. Edge Cases & Failure Modes

### 6.1 Delete Outcome With Existing Route

**Scenario:** User attempts to delete Outcome that has Gate route defined.

**Required Behavior:**
- Option A: Reject deletion, require route deletion first
- Option B: Cascade delete route with confirmation
- Error message indicates route exists

*Source: 50_flowspec_builder_ui_api_map.md §2.4*

### 6.2 Update Published Workflow

**Scenario:** User attempts to PATCH a Published Workflow.

**Required Behavior:**
- Request rejected
- Error indicates Published Workflows are immutable
- HTTP 403 or 400 with appropriate error code

### 6.3 Create Gate With Non-Existent Target

**Scenario:** User creates Gate route to Node ID that doesn't exist.

**Required Behavior:**
- Request rejected at API level
- Error indicates target Node not found
- Gate not created

### 6.4 Concurrent Edit Conflict

**Scenario:** Two users edit same Draft Workflow simultaneously.

**Required Behavior:**
- Last-write-wins or optimistic locking (implementation choice)
- No data corruption
- Consider: versioning/etag for conflict detection

---

## 7. Invariants Enforced

| ID | Invariant | API Enforcement |
|----|-----------|-----------------|
| INV-007 | Outcome Immutability | No Outcome PATCH/DELETE on Flows |
| INV-010 | Flow Bound to Version | No Workflow version PATCH on Flows |
| INV-011 | Published Immutable | No PATCH on Published Workflows |
| INV-024 | Gate Key is Node-Level | Gates use sourceNodeId |

---

## 8. Implementation Notes

### 8.1 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Workflow validation failed",
    "details": [
      {
        "path": "nodes[0].tasks[2].outcomes",
        "code": "ORPHANED_OUTCOME",
        "message": "Outcome 'RETRY' has no gate route"
      }
    ]
  },
  "timestamp": "2026-01-28T12:00:00Z"
}
```

*Source: 50_flowspec_builder_ui_api_map.md §6.2*

### 8.2 Gate Create Request

```json
{
  "sourceNodeId": "N1",
  "outcomeId": "outcome-approved",
  "targetNodeId": "N2"
}
```

Note: Uses `sourceNodeId`, not `sourceTaskId`.

### 8.3 Terminal Route

To create a terminal route (no target Node):

```json
{
  "sourceNodeId": "N4",
  "outcomeId": "outcome-completed",
  "targetNodeId": null
}
```

### 8.4 Dynamic Rendering

Every API route file MUST include:

```typescript
export const dynamic = "force-dynamic";
```

*Source: 50_flowspec_builder_ui_api_map.md §6.3*

### 8.5 Observability Events

Events SHOULD be emitted for:
- workflow.created, workflow.validated, workflow.published
- node.created, node.deleted
- task.created
- gate.created
- validation.failed

*Source: 50_flowspec_builder_ui_api_map.md §5.1*

---

## 9. Acceptance Criteria

- [ ] Workflow CRUD (Create, List, Get, Update, Delete) works
- [ ] Node CRUD within Workflows works
- [ ] Task CRUD within Nodes works
- [ ] Outcome CRUD within Tasks works
- [ ] Gate CRUD works with sourceNodeId (not sourceTaskId)
- [ ] Evidence Requirements can be configured per-Task
- [ ] Evidence Schema can be defined
- [ ] Cross-Flow Dependency CRUD works (Add, List, Delete)
- [ ] Cross-Flow Dependencies validated at publish-time (source exists, task exists, outcome valid)
- [ ] Circular cross-flow dependencies flagged as errors at publish-time
- [ ] Fan-Out Rule CRUD works (Add, List, Delete)
- [ ] Fan-Out Rules validated at publish-time (target Workflow Published, outcome valid)
- [ ] Validate endpoint returns all validation errors
- [ ] Publish endpoint only works on Validated Workflows
- [ ] Version list endpoint returns all Published versions
- [ ] Branch endpoint creates Draft from Published version
- [ ] PATCH on Published Workflow is rejected
- [ ] Forbidden routes do not exist
- [ ] All routes include `export const dynamic = "force-dynamic"`
- [ ] Error responses include code, message, details, timestamp
- [ ] All routes require authentication
- [ ] All IDs are opaque strings
- [ ] **Tenant Isolation:** All routes reject requests where actor's `companyId` ≠ resource's `companyId`
- [ ] **Tenant Isolation:** List endpoints return only resources matching actor's `companyId`
- [ ] **Tenant Isolation:** Create endpoints assign actor's `companyId` to new resources

#### Drift Protection (M1 Guards Required)

- [ ] `guard_flowspec_forbidden_routes.mjs` passes (no PATCH/DELETE on Outcome, no DELETE on Evidence, no PATCH on WorkflowVersion)
- [ ] `guard_flowspec_route_tenant_check.mjs` passes (all routes call tenant validation helper)

---

## 10. Open Questions

None — canon complete.
