# FlowSpec Builder Screen-to-API Matrix

**Document ID:** 42_flowspec_builder_screen_api_matrix  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Phase:** Phase 1 (Structured Builder)  
**Related Documents:**
- [41_flowspec_structured_builder_ux.md](./41_flowspec_structured_builder_ux.md) — UX Specification
- [50_flowspec_builder_ui_api_map.md](./50_flowspec_builder_ui_api_map.md) — Full API reference

---

## 1. Purpose

This document provides a strict wiring specification between Structured Builder UI screens and FlowSpec API routes. Every user action maps to exactly one API call.

**Rule:** This document uses ONLY APIs proven to exist in the codebase (per Step 1 Gap Audit). No invented endpoints.

---

## 2. API Route Inventory (Proven)

The following routes are confirmed to exist:

### 2.1 Workflow Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows` | GET, POST | `src/app/api/flowspec/workflows/route.ts` |
| `/api/flowspec/workflows/[id]` | GET, PATCH, DELETE | `src/app/api/flowspec/workflows/[id]/route.ts` |
| `/api/flowspec/workflows/[id]/validate` | POST | `src/app/api/flowspec/workflows/[id]/validate/route.ts` |
| `/api/flowspec/workflows/[id]/publish` | POST | `src/app/api/flowspec/workflows/[id]/publish/route.ts` |
| `/api/flowspec/workflows/[id]/versions` | GET | Directory exists |
| `/api/flowspec/workflows/[id]/versions/[versionId]` | GET | Directory exists |
| `/api/flowspec/workflows/[id]/versions/[versionId]/branch` | POST | Directory exists |

### 2.2 Node Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/nodes` | POST | `src/app/api/flowspec/workflows/[id]/nodes/route.ts` |
| `/api/flowspec/workflows/[id]/nodes/[nodeId]` | PATCH, DELETE | `src/app/api/flowspec/workflows/[id]/nodes/[nodeId]/route.ts` |

### 2.3 Task Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks` | POST | Directory exists |
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]` | PATCH, DELETE | Directory exists |
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/reorder` | PATCH | Directory exists |

### 2.4 Outcome Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]/outcomes` | POST | Directory exists |
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]/outcomes/[outcomeId]` | PATCH, DELETE | Directory exists |

### 2.5 Gate Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/gates` | POST | Directory exists |
| `/api/flowspec/workflows/[id]/gates/[gateId]` | PATCH, DELETE | Directory exists |

### 2.6 Evidence Schema Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]/evidence-schema` | PUT | Directory exists |

### 2.7 Cross-Flow Dependency Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]/cross-flow-dependencies` | GET, POST | Directory exists |
| `/api/flowspec/workflows/[id]/nodes/[nodeId]/tasks/[taskId]/cross-flow-dependencies/[depId]` | DELETE | Directory exists |

### 2.8 Fan-Out Rule Routes

| Route | Methods | File Evidence |
|-------|---------|---------------|
| `/api/flowspec/workflows/[id]/fan-out-rules` | GET, POST | Directory exists |
| `/api/flowspec/workflows/[id]/fan-out-rules/[ruleId]` | DELETE | Directory exists |

---

## 3. Screen-to-API Wiring Matrix

### 3.1 Workflow List Screen (`/flowspec`)

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Load workflow list | `/api/flowspec/workflows` | GET | — | Authenticated | Tenant-scoped |
| Create new workflow | `/api/flowspec/workflows` | POST | `{ name, description? }` | Authenticated | Creates DRAFT |
| Open workflow | — | — | — | Navigation only | — |
| Delete workflow | `/api/flowspec/workflows/[id]` | DELETE | — | Draft only | — |
| Search/filter | `/api/flowspec/workflows?search=X` | GET | — | Authenticated | Tenant-scoped |

### 3.2 Workflow Detail Screen (`/flowspec/workflows/[id]`)

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Load workflow | `/api/flowspec/workflows/[id]` | GET | — | Authenticated | Tenant-scoped |
| Rename workflow | `/api/flowspec/workflows/[id]` | PATCH | `{ name }` | Draft only | INV-011 |
| Update description | `/api/flowspec/workflows/[id]` | PATCH | `{ description }` | Draft only | INV-011 |
| Toggle non-terminating | `/api/flowspec/workflows/[id]` | PATCH | `{ isNonTerminating }` | Draft only | INV-011 |
| Validate workflow | `/api/flowspec/workflows/[id]/validate` | POST | — | Draft only | — |
| Publish workflow | `/api/flowspec/workflows/[id]/publish` | POST | — | Validated only | INV-011 |
| List versions | `/api/flowspec/workflows/[id]/versions` | GET | — | Authenticated | — |
| View version | `/api/flowspec/workflows/[id]/versions/[vId]` | GET | — | Authenticated | Read-only |
| Branch from version | `/api/flowspec/workflows/[id]/versions/[vId]/branch` | POST | — | Authenticated | Creates DRAFT |
| Delete workflow | `/api/flowspec/workflows/[id]` | DELETE | — | Draft only | — |

### 3.3 Node Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Create node | `/api/flowspec/workflows/[id]/nodes` | POST | `{ name, isEntry?, completionRule? }` | Draft only | INV-011 |
| Rename node | `/api/flowspec/workflows/[id]/nodes/[nodeId]` | PATCH | `{ name }` | Draft only | INV-011 |
| Toggle Entry | `/api/flowspec/workflows/[id]/nodes/[nodeId]` | PATCH | `{ isEntry: true/false }` | Draft only | INV-014 |
| Set completion rule | `/api/flowspec/workflows/[id]/nodes/[nodeId]` | PATCH | `{ completionRule, specificTasks? }` | Draft only | INV-011 |
| Update position | `/api/flowspec/workflows/[id]/nodes/[nodeId]` | PATCH | `{ position: {x,y} }` | Draft only | Visual only |
| Delete node | `/api/flowspec/workflows/[id]/nodes/[nodeId]` | DELETE | — | Draft only | Cascades |

### 3.4 Task Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Create task | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks` | POST | `{ name, instructions? }` | Draft only | INV-011 |
| Rename task | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]` | PATCH | `{ name }` | Draft only | INV-011 |
| Update instructions | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]` | PATCH | `{ instructions }` | Draft only | INV-011 |
| Toggle evidence required | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]` | PATCH | `{ evidenceRequired }` | Draft only | INV-011 |
| Reorder tasks | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/reorder` | PATCH | `{ order: [tId1, tId2...] }` | Draft only | Visual only |
| Delete task | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]` | DELETE | — | Draft only | Cascades |

### 3.5 Outcome Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Add outcome | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/outcomes` | POST | `{ name }` | Draft only | INV-002 |
| Rename outcome | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/outcomes/[oId]` | PATCH | `{ name }` | Draft only | INV-011 |
| Delete outcome | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/outcomes/[oId]` | DELETE | — | Draft only | Warn if routed |

### 3.6 Gate/Routing Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Create route | `/api/flowspec/workflows/[id]/gates` | POST | `{ sourceNodeId, outcomeName, targetNodeId }` | Draft only | INV-024 |
| Set terminal route | `/api/flowspec/workflows/[id]/gates` | POST | `{ sourceNodeId, outcomeName, targetNodeId: null }` | Draft only | INV-024 |
| Update target | `/api/flowspec/workflows/[id]/gates/[gateId]` | PATCH | `{ targetNodeId }` | Draft only | INV-011 |
| Delete route | `/api/flowspec/workflows/[id]/gates/[gateId]` | DELETE | — | Draft only | Creates orphan |

### 3.7 Evidence Schema Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| Set evidence schema | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/evidence-schema` | PUT | `{ schema: {...} }` | Draft only | INV-011 |

### 3.8 Cross-Flow Dependency Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| List dependencies | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/cross-flow-dependencies` | GET | — | Authenticated | — |
| Add dependency | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/cross-flow-dependencies` | POST | `{ sourceWorkflowId, sourceTaskPath, requiredOutcome }` | Draft only | INV-017 |
| Delete dependency | `/api/flowspec/workflows/[id]/nodes/[nId]/tasks/[tId]/cross-flow-dependencies/[depId]` | DELETE | — | Draft only | INV-011 |

### 3.9 Fan-Out Rule Management

| User Action | API Route | Method | Request Body | Preconditions | Invariants |
|-------------|-----------|--------|--------------|---------------|------------|
| List fan-out rules | `/api/flowspec/workflows/[id]/fan-out-rules` | GET | — | Authenticated | — |
| Add fan-out rule | `/api/flowspec/workflows/[id]/fan-out-rules` | POST | `{ sourceNodeId, triggerOutcome, targetWorkflowId }` | Draft only | Target must be Published |
| Delete fan-out rule | `/api/flowspec/workflows/[id]/fan-out-rules/[ruleId]` | DELETE | — | Draft only | INV-011 |

---

## 4. Response Handling

### 4.1 Success Responses

| Status | Meaning | UI Response |
|--------|---------|-------------|
| 200 | Success | Refresh data, show success toast |
| 201 | Created | Add to list, show success toast |

### 4.2 Error Responses

| Status | Code | Meaning | UI Response |
|--------|------|---------|-------------|
| 400 | NAME_REQUIRED | Missing required field | Show inline error |
| 400 | NAME_EXISTS | Duplicate name | Show inline error |
| 400 | VALIDATION_FAILED | Workflow invalid | Show validation panel |
| 403 | PUBLISHED_IMMUTABLE | Tried to edit Published | Disable edit, show tooltip |
| 403 | FORBIDDEN | Tenant mismatch | Redirect to list |
| 404 | NOT_FOUND | Resource doesn't exist | Show error, redirect |

### 4.3 Standard Error Shape

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Workflow validation failed",
    "details": [...]
  },
  "timestamp": "2026-01-28T12:00:00Z"
}
```

---

## 5. Data Flow Diagrams

### 5.1 Create Workflow Flow

```
User clicks "New Workflow"
    │
    ▼
Modal opens → User enters name
    │
    ▼
POST /api/flowspec/workflows { name }
    │
    ├── 201 Created → Navigate to /flowspec/workflows/[newId]
    │
    └── 400 Error → Show error in modal
```

### 5.2 Edit Node Flow

```
User clicks Node in list
    │
    ▼
Node Detail Panel opens (data from GET workflow response)
    │
    ▼
User edits name, blurs field
    │
    ▼
PATCH /api/flowspec/workflows/[id]/nodes/[nodeId] { name }
    │
    ├── 200 OK → Update local state, show success
    │
    └── 400 Error → Show inline error, revert
```

### 5.3 Validate & Publish Flow

```
User clicks "Validate"
    │
    ▼
POST /api/flowspec/workflows/[id]/validate
    │
    ├── 200 { valid: true } → Show "✓ All checks passed"
    │                         Enable Publish button
    │
    └── 200 { valid: false, errors: [...] } → Show errors in panel
                                              Disable Publish button
    │
    ▼ (if valid)
User clicks "Publish"
    │
    ▼
Confirmation modal → User confirms
    │
    ▼
POST /api/flowspec/workflows/[id]/publish
    │
    ├── 200 OK → Show success, update status to PUBLISHED
    │
    └── 400 VALIDATION_FAILED → Show errors (re-validate failed)
```

### 5.4 Routing Editor Flow

```
User opens Routing Editor section
    │
    ▼
Display Outcomes grouped by Node (from GET workflow response)
For each Outcome, show current targetNodeId (may be null/undefined)
    │
    ▼
User selects target from dropdown for Outcome X
    │
    ├── If no existing Gate → POST /api/flowspec/workflows/[id]/gates
    │                          { sourceNodeId, outcomeName, targetNodeId }
    │
    └── If existing Gate → PATCH /api/flowspec/workflows/[id]/gates/[gateId]
                           { targetNodeId }
    │
    ▼
200 OK → Update table row, show ✓
```

---

## 6. Precondition Enforcement

### 6.1 Draft-Only Operations

The following operations require `workflow.status === "DRAFT"`:

| Operation | API Route |
|-----------|-----------|
| PATCH workflow | `/api/flowspec/workflows/[id]` |
| DELETE workflow | `/api/flowspec/workflows/[id]` |
| POST/PATCH/DELETE node | `/api/flowspec/workflows/[id]/nodes/**` |
| POST/PATCH/DELETE task | `/api/flowspec/workflows/[id]/**/tasks/**` |
| POST/PATCH/DELETE outcome | `/api/flowspec/workflows/[id]/**/outcomes/**` |
| POST/PATCH/DELETE gate | `/api/flowspec/workflows/[id]/gates/**` |
| PUT evidence-schema | `/api/flowspec/workflows/[id]/**/evidence-schema` |
| POST/DELETE cross-flow-dep | `/api/flowspec/workflows/[id]/**/cross-flow-dependencies/**` |
| POST/DELETE fan-out-rule | `/api/flowspec/workflows/[id]/fan-out-rules/**` |

**UI Enforcement:** When `workflow.status !== "DRAFT"`:
- All edit controls are disabled
- Add/Delete buttons are hidden or disabled
- Tooltips explain "Published workflows cannot be modified"

### 6.2 Validated-Only Operations

| Operation | Precondition | API Route |
|-----------|--------------|-----------|
| Publish | `workflow.status === "VALIDATED"` | POST .../publish |

**UI Enforcement:**
- Publish button disabled unless status is VALIDATED
- Tooltip: "Validate workflow before publishing"

---

## 7. Invariant Mapping

| Invariant | API Enforcement | UI Enforcement |
|-----------|-----------------|----------------|
| INV-002 (Explicit Outcomes) | POST outcomes validates name | Outcome name required in form |
| INV-007 (Outcome Immutability) | Runtime outcomes not editable via Builder | No runtime outcome editing exposed |
| INV-008 (All Outcomes Routed) | Validation fails if orphaned | Routing Editor shows ⚠ |
| INV-011 (Published Immutable) | API returns 403 on edit | Edit controls disabled |
| INV-014 (Entry Node Required) | Validation fails if no entry | UI shows error, prevents unmark of last |
| INV-017 (Cross-Flow User-Authored) | Dependencies only created via UI/API | Add Dependency modal |
| INV-024 (Gate Key Node-Level) | API uses sourceNodeId | Routing Editor groups by Node |

---

## 8. API Not Used in Structured Builder

The following routes exist but are NOT used in Phase 1 Structured Builder:

| Route | Reason |
|-------|--------|
| `/api/flowspec/actionable-tasks` | Work Station (runtime), not Builder |
| `/api/flowspec/flow-groups/[id]/actionable-tasks` | Work Station (runtime), not Builder |
| `/api/flowspec/flows/[flowId]/tasks/[taskId]/outcome` | Work Station (runtime), not Builder |
| `/api/flowspec/flows/[flowId]/tasks/[taskId]/evidence` | Work Station (runtime), not Builder |

These routes support execution/runtime and are out of scope for the Builder UI.

---

**End of Document**
