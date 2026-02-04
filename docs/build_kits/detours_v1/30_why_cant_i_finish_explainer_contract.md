# 30 "Why Can't I Finish?" Explainer Contract

## Goal
To provide a single, deterministic source of truth for why a flow or node is currently blocked, ensuring users are never left with "Unknown" or vague errors.

**Every refused action MUST map to exactly one ReasonCode.**

---

## Contract

### Input
- `current_flow_state`: The raw state of the flow engine.
- `active_detours`: List of all open detour records.
- `validity_overlay`: Map of node IDs to their current validity status (PROVISIONAL, INVALID, VALID).
- `action_attempted`: The action being refused (e.g., `COMPLETE_FLOW`, `COMPLETE_NODE`, `RESOLVE_DETOUR`).

### Output
- `reason_code`: A single enum value from the ReasonCode taxonomy (required).
- `explanation`: A single clear sentence (required).
- `required_actions`: (Optional) A list of specific tasks or evidence required to unblock.
- `blocking_entity_id`: The ID of the detour, node, or evidence causing the block.

---

## Reason Code Taxonomy

Every block condition MUST map to exactly one of these codes:

| ReasonCode | Description | Priority |
|------------|-------------|----------|
| `ACTIVE_BLOCKING_DETOUR` | A blocking detour prevents completion or downstream work. | 1 (highest) |
| `ACTIVE_NONBLOCKING_DETOUR` | A non-blocking detour exists; flow cannot complete but work continues. | 2 |
| `JOIN_BLOCKED` | A join node cannot activate because one or more branches have active detours. | 3 |
| `UPSTREAM_PROVISIONAL` | A predecessor node has PROVISIONAL validity; successor cannot finalize. | 4 |
| `INVALID_EVIDENCE` | Required evidence was marked INVALID; must be replaced. | 5 |
| `REMEDIATION_REQUIRED` | Detour was converted to remediation loop; cannot resolve via detour path. | 6 |
| `POLICY_ESCALATED` | Admin policy change escalated a detour to blocking. | 7 |
| `EXTERNAL_DEPENDENCY` | Waiting for external event (e.g., AHJ re-inspection). | 8 |
| `TIMEOUT_STALLED` | Detour has exceeded time threshold; requires admin attention. | 9 |
| `EVIDENCE_MISSING` | Resolution attempted without required evidence types. | 10 |
| `NESTED_DETOUR_FORBIDDEN` | Attempted to open a detour from within an active detour (v1 constraint). | 11 |
| `SCOPE_CHANGE_INVALIDATION` | A change order invalidated the active detour's assumptions. | 12 |
| `FLOWGROUP_INCOMPLETE` | Child flows in the FlowGroup have unresolved detours. | 13 |
| `SAFETY_ESCALATION_REQUIRED` | Outcome marked as unsafe; non-blocking detour is forbidden. | 14 (lowest) |

---

## Priority Ordering

When multiple blocking conditions exist, return the **highest priority** (lowest number) ReasonCode.

**Resolution**: If a flow has both `ACTIVE_BLOCKING_DETOUR` (priority 1) and `INVALID_EVIDENCE` (priority 5), return `ACTIVE_BLOCKING_DETOUR`.

**Chaining**: The `required_actions` field may include actions for secondary blockers, but the primary `reason_code` is always the highest priority.

---

## "Never Return Unknown" Requirement

The explainer MUST exhaustively check for blocking conditions. If no explicit block is found but completion is refused:
1. Log an internal error: `EXPLAINER_COVERAGE_GAP`.
2. Return a fallback message: "An unexpected condition is preventing completion. Contact support with reference ID {trace_id}."
3. This MUST trigger an alert for engineering review.

**Goal**: This fallback should NEVER be reached in production. Any occurrence indicates a missing ReasonCode.

---

## Coverage Guarantee

The explainer MUST handle these action types:

| Action | ReasonCodes That Can Block |
|--------|---------------------------|
| `COMPLETE_FLOW` | All codes except `NESTED_DETOUR_FORBIDDEN` |
| `COMPLETE_NODE` | `ACTIVE_BLOCKING_DETOUR`, `UPSTREAM_PROVISIONAL`, `INVALID_EVIDENCE` |
| `RESOLVE_DETOUR` | `EVIDENCE_MISSING`, `SCOPE_CHANGE_INVALIDATION`, `REMEDIATION_REQUIRED` |
| `OPEN_DETOUR` | `NESTED_DETOUR_FORBIDDEN`, `SAFETY_ESCALATION_REQUIRED` |
| `ACTIVATE_JOIN` | `JOIN_BLOCKED` |

---

## Examples

### 1. Blocking Detour
- **Action**: `COMPLETE_FLOW`
- **Input**: Detour #45 (BLOCKING) at "Electrical Rough".
- **Output**:
  - `reason_code`: `ACTIVE_BLOCKING_DETOUR`
  - `explanation`: "Completion is blocked by an active correction at Electrical Rough."
  - `required_actions`: ["Fix bonding deficiencies", "Upload verification photo"]
  - `blocking_entity_id`: "det_045"

### 2. Non-Blocking Detour (at completion)
- **Action**: `COMPLETE_FLOW`
- **Input**: Detour #46 (NON-BLOCKING) at "Final Inspection".
- **Output**:
  - `reason_code`: `ACTIVE_NONBLOCKING_DETOUR`
  - `explanation`: "The job cannot be closed while the PV Label correction is active."
  - `required_actions`: ["Replace/verify PV labels", "Upload 6 photos"]
  - `blocking_entity_id`: "det_046"

### 3. Join Blocked
- **Action**: `ACTIVATE_JOIN`
- **Input**: All branches VALID except Fire Alarm (ACTIVE Detour).
- **Output**:
  - `reason_code`: `JOIN_BLOCKED`
  - `explanation`: "The Certificate of Occupancy is waiting for the Fire Alarm correction to resolve."
  - `required_actions`: ["Complete Fire Alarm retest checklist"]
  - `blocking_entity_id`: "det_047"

### 4. Evidence Invalid
- **Action**: `COMPLETE_NODE`
- **Input**: Evidence for "Panel Labeling" marked INVALID.
- **Output**:
  - `reason_code`: `INVALID_EVIDENCE`
  - `explanation`: "Prior evidence for Panel Labeling was rejected and requires correction."
  - `required_actions`: ["Upload correct panel labeling photos"]
  - `blocking_entity_id`: "evidence_789"

### 5. Remediation Required
- **Action**: `RESOLVE_DETOUR`
- **Input**: Detour escalated to Remediation Loop.
- **Output**:
  - `reason_code`: `REMEDIATION_REQUIRED`
  - `explanation`: "A structural correction (Remediation) is required due to repeated failures at Base Prep."
  - `required_actions`: ["Execute Base Prep Compaction Check"]
  - `blocking_entity_id`: "det_048"

### 6. Upstream Provisional
- **Action**: `COMPLETE_NODE` on "Drywall Release"
- **Input**: Predecessor "Electrical Rough" has validity=PROVISIONAL.
- **Output**:
  - `reason_code`: `UPSTREAM_PROVISIONAL`
  - `explanation`: "Drywall Release cannot be finalized while Electrical Rough is still provisional."
  - `required_actions`: ["Resolve correction at Electrical Rough"]
  - `blocking_entity_id`: "node_elec_rough"

### 7. Policy Escalation
- **Action**: `COMPLETE_FLOW`
- **Input**: Admin escalated CLOSEOUT_ONLY detour to blocking via policy change.
- **Output**:
  - `reason_code`: `POLICY_ESCALATED`
  - `explanation`: "Policy update: Closeout corrections now block handoff."
  - `required_actions`: ["Upload required closeout items"]
  - `blocking_entity_id`: "det_049"

### 8. External Dependency
- **Action**: `COMPLETE_FLOW`
- **Input**: Detour tasks complete, awaiting AHJ re-inspection.
- **Output**:
  - `reason_code`: `EXTERNAL_DEPENDENCY`
  - `explanation`: "Awaiting city re-inspection (scheduled for May 18). No further field work required."
  - `required_actions`: []
  - `blocking_entity_id`: "det_050"

### 9. Scope Change Invalidation
- **Action**: `RESOLVE_DETOUR`
- **Input**: Change order invalidated detour assumptions.
- **Output**:
  - `reason_code`: `SCOPE_CHANGE_INVALIDATION`
  - `explanation`: "Scope changed. Current correction no longer applies. This requires restarting the inspection process with updated equipment."
  - `required_actions`: ["Execute Remediation Loop"]
  - `blocking_entity_id`: "change_order_123"

### 10. FlowGroup Incomplete
- **Action**: `COMPLETE_FLOWGROUP`
- **Input**: Unit 6 has active detour; Units 1-5 complete.
- **Output**:
  - `reason_code`: `FLOWGROUP_INCOMPLETE`
  - `explanation`: "FlowGroup cannot complete: Unit 6 has an active correction."
  - `required_actions`: ["Resolve Unit 6 bonding fix"]
  - `blocking_entity_id`: "flow_unit6"

---

## Implementation Notes

1. **Single source**: All UI "why blocked" messages MUST call this explainer. No bespoke logic.
2. **Audit trail**: Every explainer invocation should be logged with the returned ReasonCode.
3. **Localization**: `explanation` strings should use i18n keys in production; examples above are English templates.
4. **Testing**: Every ReasonCode must have at least one contradiction test verifying it fires correctly.
