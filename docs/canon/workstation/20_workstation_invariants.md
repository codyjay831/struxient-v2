# Work Station Invariants

**Document ID:** 20_workstation_invariants  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [00_workstation_glossary.md](./00_workstation_glossary.md)
- [10_workstation_contract.md](./10_workstation_contract.md)
- [FlowSpec Invariants](../flowspec/20_flowspec_invariants.md)

---

## 1. Purpose

This document enumerates the invariants specific to Work Station. These invariants are in addition to (not replacing) FlowSpec invariants. Work Station implementations MUST satisfy both FlowSpec invariants (as a consumer) and Work Station invariants.

**Structure:** Each invariant includes:
- MUST / MUST NOT statement
- Rationale
- Violation example
- Detection idea (conceptual)

---

## 2. Invariants

---

### WS-INV-001: Work Station Is Not a Workflow Engine

**Statement:**  
Work Station MUST NOT execute, orchestrate, or control workflow logic. Work Station MUST only render Tasks and submit results.

**Rationale:**  
This is the foundational boundary. Violation merges Work Station with FlowSpec, creating architectural confusion and distributed execution logic.

**Violation Example:**  
Work Station contains logic: "When Task A completes, automatically start Task B" without querying FlowSpec.

**Detection Idea:**  
Code review for any workflow logic (sequencing, routing, gating) in Work Station codebase. Presence indicates violation.

---

### WS-INV-002: Actionability Sourced from FlowSpec Only

**Statement:**  
Work Station MUST obtain Actionability information exclusively from FlowSpec. Work Station MUST NOT compute, infer, or cache Actionability as authoritative.

**Rationale:**  
Distributed Actionability computation causes inconsistency. FlowSpec is the single source of truth for what can be worked on.

**Violation Example:**  
Work Station caches the Actionable Task list and continues displaying it for 10 minutes without re-querying, even after Outcomes are recorded elsewhere.

**Detection Idea:**  
Verify all Actionable Task displays trace back to a FlowSpec query. Any local computation of "should this task be shown?" indicates violation.

---

### WS-INV-003: Outcomes Submitted, Not Recorded Locally

**Statement:**  
Work Station MUST submit Outcomes to FlowSpec. Work Station MUST NOT record Outcomes in local storage as authoritative or treat local submission as confirmed before FlowSpec acknowledgment.

**Rationale:**  
Local recording creates split-brain state. FlowSpec is the authority; Work Station is a client.

**Violation Example:**  
Work Station marks Task as "Complete" in UI immediately on button click, before FlowSpec responds. If FlowSpec rejects, UI is inconsistent.

**Detection Idea:**  
Verify Task state changes in UI occur only after FlowSpec success response. Optimistic UI updates that persist on failure indicate violation.

---

### WS-INV-004: Evidence Submitted, Not Stored Locally as Truth

**Statement:**  
Work Station MUST submit Evidence to FlowSpec. Work Station MAY cache Evidence locally for draft/retry purposes but MUST NOT treat local Evidence as attached until FlowSpec confirms.

**Rationale:**  
Evidence attachment is Truth. Only FlowSpec records Truth.

**Violation Example:**  
Work Station shows "Evidence Attached" badge before FlowSpec confirms the upload, and continues showing it even if upload fails.

**Detection Idea:**  
Verify Evidence attachment indicators only appear after FlowSpec success response.

---

### WS-INV-005: No Domain-to-Domain Triggering

**Statement:**  
Work Station MUST NOT directly call, invoke, or trigger other domains (Sales, Finance, Admin) for workflow-related actions. All coordination MUST occur through FlowSpec.

**Rationale:**  
Direct domain calls create tight coupling and bypass FlowSpec's audit and routing logic.

**Violation Example:**  
When Work Station Task "Complete Installation" is done, Work Station calls Finance API directly to "unlock" the balance collection task.

**Detection Idea:**  
Audit Work Station's outbound API calls. Any call to Sales, Finance, or Admin APIs for workflow state changes indicates violation. Only FlowSpec APIs should be called for workflow operations.

---

### WS-INV-006: Graceful Stale State Handling

**Statement:**  
Work Station MUST handle stale Derived State gracefully. When FlowSpec rejects a submission due to stale state, Work Station MUST NOT crash, lose data, or display incorrect information.

**Rationale:**  
Stale state is normal in concurrent systems. Users must not suffer data loss.

**Violation Example:**  
User fills out Evidence form, submits Outcome. FlowSpec rejects (Task already completed by another user). Work Station discards the Evidence form data and shows a generic error.

**Detection Idea:**  
Test concurrent submission scenarios. Verify rejected submissions preserve user-entered data and show informative error.

---

### WS-INV-007: Refresh After Submission

**Statement:**  
Work Station MUST refresh the Actionable Task list after any successful Outcome submission.

**Rationale:**  
Outcome recording changes Derived State. Displaying stale task list misleads users.

**Violation Example:**  
User completes a Task. Task disappears from list. But a newly Actionable Task (gated by the completed Task's Outcome) does not appear until manual page refresh.

**Detection Idea:**  
Verify automatic refresh occurs after successful submission. New Actionable Tasks should appear without manual intervention.

---

### WS-INV-008: Authentication Required for All Operations

**Statement:**  
Work Station MUST require authenticated session for viewing Tasks and submitting Outcomes/Evidence. Unauthenticated access MUST be denied.

**Rationale:**  
Workflow operations are sensitive. Unauthenticated access violates security principles.

**Violation Example:**  
Work Station has a public URL that displays Task details without login.

**Detection Idea:**  
Attempt to access Work Station URLs without authentication. All should redirect to login or return 401.

---

### WS-INV-009: Multi-Flow Display Without Local Filtering

**Statement:**  
When displaying Tasks from multiple Flows, Work Station MUST NOT filter Tasks by Flow origin based on internal logic. Filtering MUST only occur based on FlowSpec query parameters or explicit user preference.

**Rationale:**  
Work Station should not make assumptions about which Flow's Tasks are "relevant." FlowSpec determines Actionability; user preferences determine display.

**Violation Example:**  
Work Station only shows Execution Flow Tasks and hides Finance Flow Tasks because a developer assumed "Work Station is for execution work only."

**Detection Idea:**  
Query FlowSpec for Actionable Tasks in a Flow Group with multiple Flows. Verify Work Station displays Tasks from all Flows.

---

### WS-INV-010: No Outcome Inference

**Statement:**  
Work Station MUST NOT infer or auto-select Outcomes based on user behavior, time elapsed, or any factor other than explicit user selection.

**Rationale:**  
Outcomes must be explicit per FlowSpec INV-002. Inferred Outcomes create audit and routing problems.

**Violation Example:**  
If user uploads Evidence but doesn't select Outcome within 5 minutes, Work Station auto-submits "COMPLETE" Outcome.

**Detection Idea:**  
Verify all Outcome submissions trace to explicit user action (button click, form submit). Any automatic Outcome recording indicates violation.

---

### WS-INV-011: Evidence Preservation on Failure

**Statement:**  
Work Station MUST preserve user-entered Evidence data when submission fails. Users MUST be able to retry without re-entering data.

**Rationale:**  
Evidence entry can be time-consuming. Losing work frustrates users and wastes effort.

**Violation Example:**  
User uploads a 50MB file and fills out notes. Network fails. Work Station clears the form on error.

**Detection Idea:**  
Simulate network failure during submission. Verify form data is retained and retry is possible.

---

### WS-INV-012: Idempotent Submission Handling

**Statement:**  
Work Station MUST handle submission retries safely. Duplicate submissions (due to network retry or user re-click) MUST NOT cause errors or duplicate records.

**Rationale:**  
Network unreliability is common. Users should be able to retry without fear of corruption.

**Violation Example:**  
User clicks "Submit" twice quickly. Two Outcome records are created, or an error is shown.

**Detection Idea:**  
Simulate double-click or network retry. Verify single Outcome recorded and no error displayed to user.

---

## 3. Invariant Index

| ID | Short Name | Category |
|----|------------|----------|
| WS-INV-001 | Not a Workflow Engine | Boundary |
| WS-INV-002 | Actionability from FlowSpec | Data Source |
| WS-INV-003 | Outcomes Submitted, Not Local | Data Source |
| WS-INV-004 | Evidence Submitted, Not Local | Data Source |
| WS-INV-005 | No Domain Triggering | Boundary |
| WS-INV-006 | Graceful Stale Handling | Reliability |
| WS-INV-007 | Refresh After Submission | UX |
| WS-INV-008 | Authentication Required | Security |
| WS-INV-009 | No Local Flow Filtering | Multi-Flow |
| WS-INV-010 | No Outcome Inference | Outcomes |
| WS-INV-011 | Evidence Preservation | Reliability |
| WS-INV-012 | Idempotent Submission | Reliability |

---

## 4. Relationship to FlowSpec Invariants

Work Station, as a FlowSpec consumer, must respect FlowSpec invariants indirectly:

| FlowSpec Invariant | Work Station Implication |
|--------------------|-------------------------|
| INV-002: Explicit Outcomes | Work Station must not infer Outcomes (WS-INV-010) |
| INV-009: FlowSpec Owns Truth | Work Station must submit, not record locally (WS-INV-003, WS-INV-004) |
| INV-018: Domains Don't Trigger | Work Station must not call other domains (WS-INV-005) |
| INV-019: FlowSpec Evaluates Actionability | Work Station must not compute Actionability (WS-INV-002) |

---

**End of Document**
