# 50 Contradiction Tests Plan

## Goal
To define "must-fail" scenarios that would violate the fundamental invariants of the Detour system. These tests MUST fail if the system is working correctly.

**Minimum requirement: 12 must-fail tests.**

---

## Test Scenarios

### 1. Complete Flow with Active Non-Blocking Detour
- **Preconditions**: Flow is ACTIVE, 1 Detour is OPEN (Non-blocking).
- **Action**: Call `attempt_complete(flow_id)`.
- **Expected Failure**: System refuses completion.
- **Expected ReasonCode**: `ACTIVE_NONBLOCKING_DETOUR`
- **Explainer Message**: "The job cannot be closed while the [Detour Name] correction is active."

---

### 2. Complete Flow with Active Blocking Detour
- **Preconditions**: Flow is ACTIVE, 1 Detour is OPEN (Blocking).
- **Action**: Call `attempt_complete(flow_id)`.
- **Expected Failure**: System refuses completion.
- **Expected ReasonCode**: `ACTIVE_BLOCKING_DETOUR`
- **Explainer Message**: "Completion is blocked by an active correction at [Checkpoint]."

---

### 3. Detour on Unsafe Outcome (Non-Blocking Forbidden)
- **Preconditions**: A node outcome is marked as "UNSAFE" (structural/safety failure).
- **Action**: Attempt to open a NON_BLOCKING detour.
- **Expected Failure**: System forces BLOCKING or Remediation Loop.
- **Expected ReasonCode**: `SAFETY_ESCALATION_REQUIRED`
- **Explainer Message**: "Safety-critical failures cannot be handled via non-blocking detours."

---

### 4. Resolve Detour Without Required Evidence
- **Preconditions**: Detour opened with `required_evidence_types: ["photo", "checklist"]`.
- **Action**: Call `resolve_detour(detour_id, evidence_set: [])`.
- **Expected Failure**: Validation error.
- **Expected ReasonCode**: `EVIDENCE_MISSING`
- **Explainer Message**: "Resolution requires the following evidence: photo, checklist."

---

### 5. Open Nested Detour (v1 Constraint)
- **Preconditions**: Detour A is ACTIVE at checkpoint X.
- **Action**: Attempt to open Detour B at checkpoint Y (within same flow).
- **Expected Failure**: System refuses (v1 constraint).
- **Expected ReasonCode**: `NESTED_DETOUR_FORBIDDEN`
- **Explainer Message**: "Nested detours are not supported in this version."

---

### 6. Complete Successor Node While Blocking Detour Active
- **Preconditions**: Detour at Node A is BLOCKING. Node B is a direct successor of Node A.
- **Action**: Attempt to mark Node B as COMPLETE.
- **Expected Failure**: Actionability guard prevents completion.
- **Expected ReasonCode**: `ACTIVE_BLOCKING_DETOUR`
- **Explainer Message**: "Work is paused on [Node B] until the correction at [Node A] is resolved."

---

### 7. Resolve Detour with Previously INVALID Evidence
- **Preconditions**: Evidence E1 was marked INVALID via `invalidate_evidence`.
- **Action**: Attempt to resolve detour using E1 in the evidence_set.
- **Expected Failure**: Evidence validation fails.
- **Expected ReasonCode**: `INVALID_EVIDENCE`
- **Explainer Message**: "Rejected evidence cannot be used to resolve a detour."

---

### 8. Resolve Detour but Validity Remains PROVISIONAL
- **Preconditions**: Detour resolved successfully.
- **Action**: Check validity of checkpoint node.
- **Expected Failure**: If validity is still PROVISIONAL after successful resolution, this is a bug.
- **Expected State**: `validity[checkpoint_id] == 'VALID'`
- **Test Assertion**: `validity[checkpoint_id] != 'PROVISIONAL'`

---

### 9. Complete Node Using PROVISIONAL Outcome Under ALL_TASKS_DONE
- **Preconditions**: Node has `completion_rule: ALL_TASKS_DONE`. One task's outcome has validity=PROVISIONAL.
- **Action**: Attempt to complete the node.
- **Expected Failure**: Node completion refused.
- **Expected ReasonCode**: `UPSTREAM_PROVISIONAL`
- **Explainer Message**: "[Node] cannot be finalized while [Task] outcome is still provisional."

---

### 10. Escalation Audit Missing Who/When/Why
- **Preconditions**: Detour is NON_BLOCKING.
- **Action**: Call `escalate_detour(detour_id, reason: "", escalated_by: null)`.
- **Expected Failure**: Validation error; escalation rejected.
- **Expected Error**: "Escalation requires escalated_by and reason fields."
- **Audit Requirement**: Every escalation MUST have who, when, and why.

---

### 11. Join Node Activates While Blocking Detour Exists in One Branch
- **Preconditions**: Join node J requires branches A, B, C to be complete. A and B are VALID. C has an ACTIVE BLOCKING detour.
- **Action**: Attempt to activate/mark J as actionable.
- **Expected Failure**: Join remains blocked.
- **Expected ReasonCode**: `JOIN_BLOCKED`
- **Explainer Message**: "[Join Node] is waiting for the correction in [Branch C] to resolve."

---

### 12. Downstream Node Marked Complete While Upstream Blocking Detour Exists
- **Preconditions**: Node A has BLOCKING detour. Node C is a downstream successor (not direct, but in path).
- **Action**: Attempt to mark Node C as COMPLETE.
- **Expected Failure**: Completion refused due to upstream blocker.
- **Expected ReasonCode**: `ACTIVE_BLOCKING_DETOUR`
- **Explainer Message**: "Work is blocked upstream at [Node A]."

---

### 13. FlowGroup Completion While Child Flow Has Active Detour
- **Preconditions**: FlowGroup with 6 child flows. Flows 1-5 are COMPLETED. Flow 6 has ACTIVE detour.
- **Action**: Attempt to mark FlowGroup as COMPLETED.
- **Expected Failure**: FlowGroup completion refused.
- **Expected ReasonCode**: `FLOWGROUP_INCOMPLETE`
- **Explainer Message**: "FlowGroup cannot complete: [Flow 6] has an active correction."

---

### 14. Resolve Detour After Scope Change Invalidation
- **Preconditions**: Change order invalidated active detour. Validity set to INVALID. Remediation required.
- **Action**: Attempt to resolve detour with new evidence (without going through remediation).
- **Expected Failure**: Resolution refused.
- **Expected ReasonCode**: `SCOPE_CHANGE_INVALIDATION`
- **Explainer Message**: "Scope changed. Current correction no longer applies. Remediation required."

---

### 15. Force-Complete with EXTERNAL_DEPENDENCY Pending
- **Preconditions**: Detour tasks complete. Awaiting external re-inspection. Detour still ACTIVE.
- **Action**: Admin attempts to force-complete the flow.
- **Expected Failure**: Completion refused.
- **Expected ReasonCode**: `EXTERNAL_DEPENDENCY`
- **Explainer Message**: "Awaiting external inspection. Cannot bypass."

---

## Test Implementation Notes

1. **Each test must be automated**: Integrate with the simulation harness from 20_simulation_harness_spec.md.
2. **Each ReasonCode must have at least one test**: Cross-reference with 30_why_cant_i_finish_explainer_contract.md.
3. **Assertions are strict**: Tests fail if the system ACCEPTS the action instead of refusing.
4. **Coverage matrix**: Maintain a matrix showing which tests cover which ReasonCodes.

---

## Coverage Matrix

| ReasonCode | Test(s) |
|------------|---------|
| `ACTIVE_BLOCKING_DETOUR` | 2, 6, 12 |
| `ACTIVE_NONBLOCKING_DETOUR` | 1 |
| `JOIN_BLOCKED` | 11 |
| `UPSTREAM_PROVISIONAL` | 9 |
| `INVALID_EVIDENCE` | 7 |
| `EVIDENCE_MISSING` | 4 |
| `REMEDIATION_REQUIRED` | (via 14) |
| `POLICY_ESCALATED` | (add test if needed) |
| `EXTERNAL_DEPENDENCY` | 15 |
| `NESTED_DETOUR_FORBIDDEN` | 5 |
| `SCOPE_CHANGE_INVALIDATION` | 14 |
| `FLOWGROUP_INCOMPLETE` | 13 |
| `SAFETY_ESCALATION_REQUIRED` | 3 |
| Escalation audit | 10 |
| Validity transition | 8 |
