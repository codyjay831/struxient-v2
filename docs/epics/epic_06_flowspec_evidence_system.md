# epic_06_flowspec_evidence_system.md

**Epic ID:** EPIC-06  
**Title:** FlowSpec Evidence System  
**Status:** SPECIFICATION  
**Canon Sources:** 00_flowspec_glossary.md, 10_flowspec_engine_contract.md, 20_flowspec_invariants.md

---

## 1. Purpose

Implement the Evidence system that handles Evidence attachment to Tasks, Evidence requirement definitions, Evidence schema validation, and enforcement of Evidence requirements before Outcome recording.

---

## 2. In-Scope Responsibilities

- Define Evidence requirements per-Task in Workflow specification
- Define Evidence schemas (types, validation rules)
- Attach Evidence to Tasks
- Validate Evidence against schema
- Enforce Evidence requirements at Outcome recording time
- Persist Evidence as append-only Truth

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Floating (unattached) Evidence | Evidence must be attached to Task (INV-005) |
| 3.2 | Evidence at Flow, Node, or Workflow level | Evidence is Task-level only |
| 3.3 | Evidence deletion or modification | Evidence is append-only Truth |
| 3.4 | File storage implementation | External concern; Evidence system handles attachment records |
| 3.5 | Evidence UI components | Work Station/Builder responsibility |

---

## 4. Authoritative Requirements

### 4.1 Evidence Attachment

- **MUST** attach Evidence to exactly one Task
  - *Source: 00_flowspec_glossary.md §2.6*
- **MUST NOT** allow Evidence to exist unattached (floating)
  - *Source: 20_flowspec_invariants.md INV-005*
- **MUST** record Evidence attachment in Truth
  - *Source: 10_flowspec_engine_contract.md §5.3.1*
- **MUST NOT** allow Evidence to be detached or deleted once attached (append-only)
  - *Source: 10_flowspec_engine_contract.md §5.3.1*

### 4.2 Evidence Requirements

- Evidence Requirements are optional per-Task
  - *Source: 10_flowspec_engine_contract.md §5.3.2*
- If Evidence Requirements exist, they **MUST** be satisfied before any Outcome is recorded
  - *Source: 10_flowspec_engine_contract.md §5.3.2*
- Attempting to record Outcome without satisfying Evidence Requirements **MUST** fail
  - *Source: 10_flowspec_engine_contract.md §5.3.2*
- Evidence Requirements **MUST** be evaluated at Outcome recording time
  - *Source: 20_flowspec_invariants.md INV-016*

### 4.3 Evidence Schema

- Evidence type and schema are defined in Task's Evidence Requirements
  - *Source: 10_flowspec_engine_contract.md §5.3.1*
- Evidence schemas **MUST** be well-formed
  - *Source: 10_flowspec_engine_contract.md §8.3.1*
- Required Evidence **MUST** be achievable (mechanism to provide exists)
  - *Source: 10_flowspec_engine_contract.md §8.3.2*

### 4.4 Evidence and Outcome Timing

- Evidence **MAY** be attached before Outcome recording
  - *Source: 10_workstation_contract.md §7.4*
- Evidence **MUST** be attached before or at Outcome recording if required
  - *Source: 20_flowspec_invariants.md INV-016*
- Evidence state at Outcome recording time is what matters
  - *Source: 20_flowspec_invariants.md INV-016*

---

## 5. System Boundaries & Ownership

| Owned by Evidence System | Delegated to Other Systems |
|-------------------------|---------------------------|
| Evidence requirement definition | File storage (external) |
| Evidence schema validation | UI for Evidence upload (Work Station) |
| Evidence attachment recording | UI for requirement configuration (Builder) |
| Requirement enforcement at Outcome time | |
| Append-only persistence | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Outcome Recording Without Required Evidence

**Scenario:** Task requires Evidence but none attached. User tries to record Outcome.

**Required Behavior:**
- Outcome recording is rejected
- Error indicates Evidence Requirements not satisfied
- User must attach Evidence first

*Source: 10_flowspec_engine_contract.md §5.3.2*

### 6.2 Evidence Attached But Schema Validation Fails

**Scenario:** User attaches Evidence but it doesn't match schema (wrong type, missing fields).

**Required Behavior:**
- Evidence attachment is rejected at attachment time
- Error indicates schema validation failure
- User must provide conforming Evidence

### 6.3 Evidence Attached After Task Started But Before Outcome

**Scenario:** User starts Task, then attaches Evidence, then records Outcome.

**Required Behavior:**
- This is valid workflow
- Evidence attachment succeeds
- Outcome recording succeeds (Evidence requirement satisfied)

*Source: 10_workstation_contract.md §7.4*

### 6.4 Multiple Evidence Attachments

**Scenario:** Task requires Evidence; user attaches multiple Evidence items.

**Required Behavior:**
- Multiple Evidence items can be attached to same Task
- Each Evidence item is persisted as separate record
- Evidence requirement satisfied if at least one valid Evidence exists (unless schema specifies otherwise)

### 6.5 Evidence Upload Fails, Retry Succeeds

**Scenario:** First Evidence upload fails (network). User retries.

**Required Behavior:**
- Failed upload is not recorded
- Retry succeeds and is recorded
- Idempotency key prevents duplicate if first actually succeeded

*Source: 10_workstation_contract.md §7.4, §7.5*

### 6.6 Post-Recording Evidence State Query

**Scenario:** After Outcome recorded, auditor queries what Evidence was present.

**Required Behavior:**
- Evidence state at recording time is preserved in Truth
- Query returns all Evidence attached up to Outcome recording time
- Post-recording Evidence additions (if allowed) are distinguishable

*Source: 20_flowspec_invariants.md INV-016*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-005 | No Floating Evidence | Evidence must be attached to exactly one Task |
| INV-016 | Evidence at Recording | Requirements evaluated at Outcome recording time |

---

## 8. Implementation Notes

### 8.1 Evidence Requirement Schema

```json
{
  "taskId": "T1.1",
  "evidenceRequired": true,
  "evidenceSchema": {
    "type": "file",
    "mimeTypes": ["image/jpeg", "image/png", "application/pdf"],
    "maxSize": 10485760,
    "description": "Upload photo documentation"
  }
}
```

### 8.2 Evidence Attachment Record

```json
{
  "evidenceId": "string",
  "taskId": "string",
  "flowId": "string",
  "type": "file | text | structured",
  "data": "reference or content",
  "attachedAt": "timestamp",
  "attachedBy": "userId"
}
```

### 8.3 Evidence Types

| Type | Description | Schema Properties |
|------|-------------|-------------------|
| file | Uploaded file | mimeTypes, maxSize |
| text | Free-form text | maxLength |
| structured | JSON data | JSON schema |

### 8.4 Evidence Requirement Check at Outcome Recording

```
function canRecordOutcome(task, flow):
  if not task.evidenceRequired:
    return true
  
  attachedEvidence = getAttachedEvidence(task, flow)
  
  if attachedEvidence.isEmpty():
    return false
  
  for evidence in attachedEvidence:
    if validatesAgainstSchema(evidence, task.evidenceSchema):
      return true
  
  return false
```

### 8.5 Attach Evidence API Pattern

```
POST /api/flowspec/flows/{flowId}/tasks/{taskId}/evidence

Request:
{
  "type": "file",
  "data": "base64 or file reference",
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "idempotencyKey": "unique-key"
}

Response (success):
{
  "evidenceId": "ev-12345",
  "success": true
}

Response (validation failure):
{
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "File type not allowed"
  }
}
```

---

## 9. Acceptance Criteria

- [ ] Evidence can be attached to a Task
- [ ] Evidence cannot be attached without specifying a Task (no floating Evidence)
- [ ] Evidence attachment is recorded in Truth
- [ ] Evidence cannot be deleted or modified after attachment
- [ ] Evidence Requirements can be defined per-Task
- [ ] Evidence schema can specify type, constraints
- [ ] Evidence attachment validates against schema
- [ ] Invalid Evidence attachment is rejected
- [ ] Outcome recording fails if required Evidence not attached
- [ ] Outcome recording succeeds if required Evidence is attached and valid
- [ ] Multiple Evidence items can be attached to same Task
- [ ] Evidence state at Outcome recording time is queryable
- [ ] Tasks without Evidence requirements can record Outcomes without Evidence

---

## 10. Open Questions

None — canon complete.
