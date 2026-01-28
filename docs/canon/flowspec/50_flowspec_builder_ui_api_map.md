# FlowSpec Builder UI/API Map

**Document ID:** 50_flowspec_builder_ui_api_map  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [40_flowspec_builder_contract.md](./40_flowspec_builder_contract.md)
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)

---

## 1. Purpose

This document maps every Builder feature to its UI location, UI control, API route, and validation rules. It serves as the authoritative reference for Builder implementation.

**IMPORTANT:** API routes marked `PLACEHOLDER:` do not exist yet. They indicate required routes that must be implemented.

**Verified Existing Routes:**
- `/api/health` — Health check endpoint (exists in repository)

---

## 2. Feature-to-UI-to-API Map

### 2.1 Workflow Management

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Create Workflow | Workflow List Page | "New Workflow" button | `PLACEHOLDER:/api/flowspec/workflows` POST | `{ name, description? }` → `{ id, name, status: "draft" }` | Name required, unique | Authenticated user |
| List Workflows | Workflow List Page | Table/Grid | `PLACEHOLDER:/api/flowspec/workflows` GET | `{}` → `{ workflows: [...] }` | None | Authenticated user |
| Get Workflow | Builder Canvas | Auto-load on open | `PLACEHOLDER:/api/flowspec/workflows/{id}` GET | `{}` → `{ workflow }` | Workflow exists | Authenticated user |
| Delete Workflow | Workflow List / Builder | Delete button + confirm | `PLACEHOLDER:/api/flowspec/workflows/{id}` DELETE | `{}` → `{ success }` | Not Published (or all versions deleted) | Authenticated user |
| Rename Workflow | Builder Header | Inline edit / modal | `PLACEHOLDER:/api/flowspec/workflows/{id}` PATCH | `{ name }` → `{ workflow }` | Name unique | Authenticated user |

### 2.2 Node Management

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Create Node | Builder Canvas | Right-click menu / toolbar button | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes` POST | `{ name, position? }` → `{ node }` | Name unique in workflow, workflow is Draft | Authenticated user |
| Update Node | Builder Canvas / Side Panel | Form fields | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` PATCH | `{ name?, completionRule?, isEntry? }` → `{ node }` | Name unique, valid completion rule | Authenticated user |
| Delete Node | Builder Canvas | Right-click menu / delete key | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` DELETE | `{}` → `{ success }` | Workflow is Draft | Authenticated user |
| Move Node | Builder Canvas | Drag | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` PATCH | `{ position: { x, y } }` → `{ node }` | None (visual only) | Authenticated user |
| Mark Entry Node | Builder Canvas / Side Panel | Checkbox / toggle | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` PATCH | `{ isEntry: true }` → `{ node }` | None | Authenticated user |
| Set Completion Rule | Side Panel | Dropdown | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` PATCH | `{ completionRule: "ALL_TASKS_DONE" }` → `{ node }` | Valid rule type | Authenticated user |

### 2.3 Task Management

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Create Task | Side Panel (Node selected) | "Add Task" button | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks` POST | `{ name }` → `{ task }` | Name unique in Node | Authenticated user |
| Update Task | Side Panel | Form fields | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` PATCH | `{ name? }` → `{ task }` | Name unique in Node | Authenticated user |
| Delete Task | Side Panel | Delete button | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` DELETE | `{}` → `{ success }` | Warn if Outcomes have routes | Authenticated user |
| Reorder Tasks | Side Panel | Drag handles | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/reorder` PATCH | `{ order: [taskId1, taskId2, ...] }` → `{ tasks }` | All task IDs valid | Authenticated user |

### 2.4 Outcome Management

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Add Outcome | Side Panel (Task selected) | "Add Outcome" button | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes` POST | `{ name }` → `{ outcome }` | Name unique in Task | Authenticated user |
| Update Outcome | Side Panel | Inline edit | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes/{outcomeId}` PATCH | `{ name }` → `{ outcome }` | Name unique in Task | Authenticated user |
| Delete Outcome | Side Panel | Delete button | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes/{outcomeId}` DELETE | `{}` → `{ success }` | Route must be deleted first (or cascade) | Authenticated user |

### 2.5 Gate (Routing) Management

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Create Route | Canvas (drag) or Side Panel | Drag from Node OR dropdown | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates` POST | `{ sourceNodeId, outcomeId, targetNodeId }` → `{ gate }` | All IDs valid, no duplicate route | Authenticated user |
| Update Route | Side Panel / Edge click | Dropdown | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates/{gateId}` PATCH | `{ targetNodeId }` → `{ gate }` | Target exists | Authenticated user |
| Delete Route | Canvas / Side Panel | Delete button / key | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates/{gateId}` DELETE | `{}` → `{ success }` | Creates orphan warning | Authenticated user |
| Set Terminal Route | Side Panel | "Terminal" option | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates` POST | `{ sourceNodeId, outcomeId, targetNodeId: null }` → `{ gate }` | Valid source | Authenticated user |

### 2.6 Evidence Requirements

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Set Evidence Required | Side Panel (Task) | Toggle | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` PATCH | `{ evidenceRequired: true }` → `{ task }` | None | Authenticated user |
| Configure Evidence Schema | Side Panel (Task) | Form / modal | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/evidence-schema` PUT | `{ schema: {...} }` → `{ task }` | Valid JSON schema | Authenticated user |
| Remove Evidence Requirement | Side Panel (Task) | Toggle off | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` PATCH | `{ evidenceRequired: false }` → `{ task }` | None | Authenticated user |

### 2.7 Validation & Publishing

| Feature | UI Location | UI Control | API Route | Request/Response (Conceptual) | Validation | Permissions |
|---------|-------------|------------|-----------|-------------------------------|------------|-------------|
| Validate Workflow | Builder Toolbar | "Validate" button | `PLACEHOLDER:/api/flowspec/workflows/{id}/validate` POST | `{}` → `{ valid: boolean, errors: [...] }` | Workflow is Draft | Authenticated user |
| Publish Workflow | Builder Toolbar | "Publish" button | `PLACEHOLDER:/api/flowspec/workflows/{id}/publish` POST | `{}` → `{ version }` | Workflow is Validated | Authenticated user |
| List Versions | Version dropdown / modal | Dropdown | `PLACEHOLDER:/api/flowspec/workflows/{id}/versions` GET | `{}` → `{ versions: [...] }` | None | Authenticated user |
| View Version | Version dropdown | Selection | `PLACEHOLDER:/api/flowspec/workflows/{id}/versions/{versionId}` GET | `{}` → `{ workflow }` | Version exists | Authenticated user |
| Create Draft from Version | Version view | "Edit as Draft" button | `PLACEHOLDER:/api/flowspec/workflows/{id}/versions/{versionId}/branch` POST | `{}` → `{ workflow (draft) }` | Version exists | Authenticated user |

---

## 3. Minimum Required API Routes

The following routes MUST be implemented for the Builder to function:

### 3.1 Workflow CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `PLACEHOLDER:/api/flowspec/workflows` | Create workflow |
| GET | `PLACEHOLDER:/api/flowspec/workflows` | List workflows |
| GET | `PLACEHOLDER:/api/flowspec/workflows/{id}` | Get workflow |
| PATCH | `PLACEHOLDER:/api/flowspec/workflows/{id}` | Update workflow |
| DELETE | `PLACEHOLDER:/api/flowspec/workflows/{id}` | Delete workflow |

### 3.2 Node CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes` | Create node |
| PATCH | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` | Update node |
| DELETE | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}` | Delete node |

### 3.3 Task CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks` | Create task |
| PATCH | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` | Update task |
| DELETE | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}` | Delete task |

### 3.4 Outcome CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes` | Add outcome |
| PATCH | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes/{outcomeId}` | Update outcome |
| DELETE | `PLACEHOLDER:/api/flowspec/workflows/{id}/nodes/{nodeId}/tasks/{taskId}/outcomes/{outcomeId}` | Delete outcome |

### 3.5 Gate CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates` | Create gate/route |
| PATCH | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates/{gateId}` | Update gate |
| DELETE | `PLACEHOLDER:/api/flowspec/workflows/{id}/gates/{gateId}` | Delete gate |

### 3.6 Lifecycle

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/validate` | Validate workflow |
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/publish` | Publish workflow |
| GET | `PLACEHOLDER:/api/flowspec/workflows/{id}/versions` | List versions |
| GET | `PLACEHOLDER:/api/flowspec/workflows/{id}/versions/{versionId}` | Get specific version |
| POST | `PLACEHOLDER:/api/flowspec/workflows/{id}/versions/{versionId}/branch` | Create draft from version |

---

## 4. Forbidden Routes

The following routes MUST NOT be implemented as they violate FlowSpec invariants:

| Forbidden Route | Reason | Invariant Violated |
|-----------------|--------|-------------------|
| `PATCH /api/flowspec/flows/{id}/tasks/{taskId}/outcome` | Mutating recorded Outcome | INV-007 (Outcome Immutability) |
| `DELETE /api/flowspec/flows/{id}/tasks/{taskId}/outcome` | Deleting recorded Outcome | INV-007 |
| `DELETE /api/flowspec/flows/{id}/evidence/{evidenceId}` | Deleting attached Evidence | Evidence is append-only |
| `PATCH /api/flowspec/workflows/{id}/versions/{versionId}` | Mutating Published version | INV-011 (Published Immutable) |
| `PATCH /api/flowspec/flows/{id}/workflowVersion` | Changing Flow's bound version | INV-010 (Flow Bound to Version) |

---

## 5. Observability Hooks (Conceptual)

The following hooks SHOULD be available for monitoring and auditing:

### 5.1 Events

| Event | Trigger | Payload (Conceptual) |
|-------|---------|----------------------|
| `workflow.created` | Workflow created | `{ workflowId, createdBy, timestamp }` |
| `workflow.validated` | Validation passed | `{ workflowId, timestamp }` |
| `workflow.published` | Workflow published | `{ workflowId, versionId, timestamp }` |
| `node.created` | Node added | `{ workflowId, nodeId, timestamp }` |
| `node.deleted` | Node removed | `{ workflowId, nodeId, timestamp }` |
| `task.created` | Task added | `{ workflowId, nodeId, taskId, timestamp }` |
| `gate.created` | Route created | `{ workflowId, gateId, sourceNodeId, outcomeId, targetNodeId, timestamp }` |
| `validation.failed` | Validation failed | `{ workflowId, errors: [...], timestamp }` |

### 5.2 Metrics (Conceptual)

| Metric | Description |
|--------|-------------|
| `flowspec.workflows.count` | Total workflows (by status) |
| `flowspec.workflows.validated.duration` | Time to validate |
| `flowspec.builder.api.latency` | API response times |
| `flowspec.builder.api.errors` | API error count |

### 5.3 Audit Log Requirements

| Requirement | Description |
|-------------|-------------|
| Actor tracking | All mutations must record who performed them |
| Timestamp | All mutations must record when |
| Before/After | State changes should capture before and after values |
| Immutable log | Audit entries cannot be modified or deleted |

---

## 6. API Design Rules

### 6.1 Request/Response Conventions

| Rule | Description |
|------|-------------|
| 6.1.1 | All requests require authenticated session |
| 6.1.2 | All responses include `timestamp` |
| 6.1.3 | Error responses include `code`, `message`, `details` |
| 6.1.4 | List responses include pagination (`limit`, `offset`, `total`) |
| 6.1.5 | All IDs are opaque strings (no sequential integers exposed) |

### 6.2 Error Response Format

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

### 6.3 Dynamic Rendering Rule

**Per Canon Rule 9:** Any API route that reads request-specific primitives MUST include:

```typescript
export const dynamic = "force-dynamic";
```

This applies to ALL routes listed in this document.

---

## 7. Permission Model (High-Level)

**NOTE:** This section describes high-level permission concepts. Detailed role systems are out-of-scope per project rules.

| Permission Level | Description | Example Actions |
|------------------|-------------|-----------------|
| Read | View workflows and versions | GET routes |
| Write | Create and modify drafts | POST, PATCH, DELETE on draft workflows |
| Publish | Publish workflows | POST .../publish |
| Admin | Delete published workflows, manage settings | DELETE on published, settings |

**Rule:** Permission enforcement is handled at the API layer. The UI disables/hides controls based on permissions but the API is the authoritative enforcer.

---

## 8. UI Control Types Reference

| Control Type | Description | Example Use |
|--------------|-------------|-------------|
| Button | Click to trigger action | "New Workflow", "Publish" |
| Dropdown | Select from options | Completion rule, target node |
| Toggle | Boolean on/off | "Mark as Entry", "Evidence Required" |
| Inline Edit | Click text to edit | Node name, Task name |
| Modal | Overlay dialog for complex input | Evidence schema configuration |
| Drag | Click and drag to reposition | Move node, reorder tasks |
| Context Menu | Right-click menu | Delete node, add task |
| Form | Multiple fields for input | Create workflow modal |
| Table/Grid | Display list of items | Workflow list |

---

## 9. Integration Surface Summary

### 9.1 Builder Consumes These FlowSpec Capabilities

| Capability | Purpose |
|------------|---------|
| Workflow CRUD | Define workflow structure |
| Validation | Check workflow correctness |
| Publishing | Make workflow executable |
| Versioning | Manage workflow versions |

### 9.2 External Domains Consume These (Not Builder)

| Route | Consumer | Purpose |
|-------|----------|---------|
| `PLACEHOLDER:/api/flowspec/flows` POST | Domain initiators | Create Flow instance |
| `PLACEHOLDER:/api/flowspec/flows/{id}/actionable` GET | Work Station | Get actionable tasks |
| `PLACEHOLDER:/api/flowspec/flows/{id}/tasks/{taskId}/outcome` POST | Work Station | Record outcome |
| `PLACEHOLDER:/api/flowspec/flows/{id}/tasks/{taskId}/evidence` POST | Work Station | Attach evidence |

These routes are execution-time routes, not Builder routes. They are listed here for completeness but are NOT part of the Builder UI/API map.

---

**End of Document**
