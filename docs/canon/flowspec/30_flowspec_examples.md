# FlowSpec Examples

**Document ID:** 30_flowspec_examples  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [20_flowspec_invariants.md](./20_flowspec_invariants.md)

---

## 1. Purpose

This document provides documentation-only examples of FlowSpec Workflow structures. These examples illustrate correct application of FlowSpec concepts.

**IMPORTANT:** These examples are for documentation and understanding only. They:
- Do NOT represent persisted or executable data
- Do NOT imply these Workflows exist in the system
- Do NOT constitute seed data, fixtures, or demo content
- Are explicitly labeled as examples

---

## 2. Example A: Linear Workflow

### 2.1 Description

A simple linear workflow where each Task completes and routes to the next Node in sequence. Demonstrates basic flow without branching or loops.

**Use Case (Illustrative):** A straightforward approval process with sequential steps.

### 2.2 Node List

| Node ID | Node Name | Entry Node | Completion Rule |
|---------|-----------|------------|-----------------|
| N1 | Submission | Yes | ALL_TASKS_DONE |
| N2 | Initial Review | No | ALL_TASKS_DONE |
| N3 | Final Approval | No | ALL_TASKS_DONE |
| N4 | Complete | No | ALL_TASKS_DONE |

### 2.3 Tasks per Node

**Node N1 (Submission):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T1.1 | Submit Request | SUBMITTED | Yes (Request Document) |

**Node N2 (Initial Review):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T2.1 | Review Submission | APPROVED, REJECTED | No |

**Node N3 (Final Approval):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T3.1 | Final Sign-off | APPROVED, REJECTED | Yes (Approval Signature) |

**Node N4 (Complete):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T4.1 | Archive Record | ARCHIVED | No |

### 2.4 Gate Routing Table

*Tasks emit outcomes; gates route node-level outcomes (INV-024).*

| Source Node | Outcome | Target Node |
|-------------|---------|-------------|
| N1 | SUBMITTED | N2 |
| N2 | APPROVED | N3 |
| N2 | REJECTED | N4 |
| N3 | APPROVED | N4 |
| N3 | REJECTED | N4 |
| N4 | ARCHIVED | (Terminal) |

### 2.5 Started/Done Semantics

| Node | Started When | Done When |
|------|--------------|-----------|
| N1 | T1.1 is started | T1.1 has Outcome |
| N2 | T2.1 is started | T2.1 has Outcome |
| N3 | T3.1 is started | T3.1 has Outcome |
| N4 | T4.1 is started | T4.1 has Outcome |

### 2.6 Diagram (Conceptual)

```
[N1: Submission] 
    │
    │ SUBMITTED
    ▼
[N2: Initial Review]
    │
    ├── APPROVED ──► [N3: Final Approval]
    │                     │
    │                     ├── APPROVED ──► [N4: Complete]
    │                     │
    │                     └── REJECTED ──► [N4: Complete]
    │
    └── REJECTED ──────────────────────► [N4: Complete]

[N4: Complete]
    │
    │ ARCHIVED
    ▼
  (Terminal)
```

---

## 3. Example B: Remediation Loop

### 3.1 Description

A workflow containing a cycle that routes back to a previous Node when remediation is required. Demonstrates loops and re-activation of Nodes.

**Use Case (Illustrative):** A quality check process where failures require rework.

### 3.2 Node List

| Node ID | Node Name | Entry Node | Completion Rule |
|---------|-----------|------------|-----------------|
| N1 | Work Submission | Yes | ALL_TASKS_DONE |
| N2 | Quality Check | No | ALL_TASKS_DONE |
| N3 | Remediation | No | ALL_TASKS_DONE |
| N4 | Accepted | No | ALL_TASKS_DONE |

### 3.3 Tasks per Node

**Node N1 (Work Submission):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T1.1 | Submit Work | SUBMITTED | Yes (Work Artifact) |

**Node N2 (Quality Check):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T2.1 | Inspect Quality | PASS, FAIL | Yes (Inspection Report) |

**Node N3 (Remediation):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T3.1 | Perform Rework | REWORK_COMPLETE | Yes (Updated Artifact) |

**Node N4 (Accepted):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T4.1 | Finalize Acceptance | ACCEPTED | No |

### 3.4 Gate Routing Table

*Tasks emit outcomes; gates route node-level outcomes (INV-024).*

| Source Node | Outcome | Target Node |
|-------------|---------|-------------|
| N1 | SUBMITTED | N2 |
| N2 | PASS | N4 |
| N2 | FAIL | N3 |
| N3 | REWORK_COMPLETE | N2 |
| N4 | ACCEPTED | (Terminal) |

**Note:** The route from N3 back to N2 creates a cycle (remediation loop).

### 3.5 Started/Done Semantics

| Node | Started When | Done When |
|------|--------------|-----------|
| N1 | T1.1 is started | T1.1 has Outcome |
| N2 | T2.1 is started | T2.1 has Outcome |
| N3 | T3.1 is started | T3.1 has Outcome |
| N4 | T4.1 is started | T4.1 has Outcome |

**Loop Behavior:**
- When N3 routes to N2, N2 is re-activated.
- T2.1 becomes Actionable again.
- Previous T2.1 Outcome remains in Truth (audit trail).
- New T2.1 execution records new Outcome.

### 3.6 Diagram (Conceptual)

```
[N1: Work Submission]
    │
    │ SUBMITTED
    ▼
[N2: Quality Check] ◄──────────────┐
    │                              │
    ├── PASS ──► [N4: Accepted]    │
    │                 │            │
    │                 │ ACCEPTED   │
    │                 ▼            │
    │            (Terminal)        │
    │                              │
    └── FAIL ──► [N3: Remediation] │
                      │            │
                      │ REWORK_    │
                      │ COMPLETE   │
                      └────────────┘
```

### 3.7 Example Execution Trace

*This trace is illustrative only and does not represent persisted data.*

| Step | Action | Truth Recorded |
|------|--------|----------------|
| 1 | Start Flow | Flow created, N1 active |
| 2 | Start T1.1 | T1.1 started timestamp |
| 3 | Record T1.1 = SUBMITTED | Outcome SUBMITTED, Evidence attached |
| 4 | Gate routes to N2 | N2 activated |
| 5 | Start T2.1 | T2.1 started timestamp |
| 6 | Record T2.1 = FAIL | Outcome FAIL, Evidence attached |
| 7 | Gate routes to N3 | N3 activated |
| 8 | Start T3.1 | T3.1 started timestamp |
| 9 | Record T3.1 = REWORK_COMPLETE | Outcome recorded, Evidence attached |
| 10 | Gate routes to N2 | N2 re-activated (loop) |
| 11 | Start T2.1 (2nd time) | T2.1 started timestamp (new record) |
| 12 | Record T2.1 = PASS | Outcome PASS |
| 13 | Gate routes to N4 | N4 activated |
| 14 | Start T4.1 | T4.1 started timestamp |
| 15 | Record T4.1 = ACCEPTED | Outcome ACCEPTED |
| 16 | Terminal reached | Flow complete |

---

## 4. Example C: External Wait/Resume

### 4.1 Description

A workflow where execution pauses to wait for an external event (e.g., third-party response, time delay, external system callback). Demonstrates waiting states and resumption.

**Use Case (Illustrative):** A process requiring external verification before proceeding.

### 4.2 Node List

| Node ID | Node Name | Entry Node | Completion Rule |
|---------|-----------|------------|-----------------|
| N1 | Initiate Request | Yes | ALL_TASKS_DONE |
| N2 | Await External Response | No | ALL_TASKS_DONE |
| N3 | Process Response | No | ALL_TASKS_DONE |
| N4 | Complete | No | ALL_TASKS_DONE |

### 4.3 Tasks per Node

**Node N1 (Initiate Request):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T1.1 | Send External Request | REQUEST_SENT | Yes (Request Payload) |

**Node N2 (Await External Response):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T2.1 | Wait for Response | RESPONSE_RECEIVED, TIMEOUT | Yes (Response Payload or Timeout Record) |

**Node N3 (Process Response):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T3.1 | Evaluate Response | VERIFIED, REJECTED, RETRY | Yes (Evaluation Notes) |

**Node N4 (Complete):**

| Task ID | Task Name | Allowed Outcomes | Evidence Required |
|---------|-----------|------------------|-------------------|
| T4.1 | Record Completion | COMPLETED | No |

### 4.4 Gate Routing Table

*Tasks emit outcomes; gates route node-level outcomes (INV-024).*

| Source Node | Outcome | Target Node |
|-------------|---------|-------------|
| N1 | REQUEST_SENT | N2 |
| N2 | RESPONSE_RECEIVED | N3 |
| N2 | TIMEOUT | N4 |
| N3 | VERIFIED | N4 |
| N3 | REJECTED | N4 |
| N3 | RETRY | N1 |
| N4 | COMPLETED | (Terminal) |

**Note:** 
- N2 represents a "waiting" state. The Task is Actionable but cannot record an Outcome until the external event occurs.
- RETRY routes back to N1, creating a retry loop.

### 4.5 Started/Done Semantics

| Node | Started When | Done When |
|------|--------------|-----------|
| N1 | T1.1 is started | T1.1 has Outcome |
| N2 | T2.1 is started | T2.1 has Outcome |
| N3 | T3.1 is started | T3.1 has Outcome |
| N4 | T4.1 is started | T4.1 has Outcome |

### 4.6 Wait Behavior

**Important Clarification:**
- FlowSpec does NOT implement timers or external polling.
- "Waiting" is simply a state where a Task is Actionable but no Outcome has been recorded.
- The external system (or a scheduled job, or a user) triggers the Outcome recording when ready.
- The Flow remains in its current state until an Outcome is recorded.

**How External Resume Works:**
1. T2.1 is started (Task is Actionable, waiting for external event).
2. External system completes its work.
3. External system calls FlowSpec's "Record Outcome" interface with RESPONSE_RECEIVED and Evidence.
4. Gate evaluates and routes to N3.

### 4.7 Diagram (Conceptual)

```
[N1: Initiate Request] ◄─────────────────────┐
    │                                        │
    │ REQUEST_SENT                           │
    ▼                                        │
[N2: Await External Response]                │
    │                                        │
    ├── RESPONSE_RECEIVED ──► [N3: Process]  │
    │                              │         │
    │                              ├── VERIFIED ──► [N4]
    │                              │               │
    │                              ├── REJECTED ──► [N4]
    │                              │               │
    │                              └── RETRY ──────┘
    │
    └── TIMEOUT ───────────────────────────► [N4: Complete]
                                                  │
                                                  │ COMPLETED
                                                  ▼
                                              (Terminal)
```

---

## 5. Example D: Parallel Flows with Cross-Flow Gating

### 5.1 Description

A pattern where multiple Flows execute in parallel for the same job, with Cross-Flow Dependencies gating actionability between them. Demonstrates fan-out from Sales and coordinated execution between Finance and Work Station Flows.

**Use Case (Illustrative):** A home services job where Sales closes the deal, then Finance and Execution proceed in parallel with coordination points.

### 5.2 Flow Group Composition

| Flow | Workflow | Purpose |
|------|----------|---------|
| Sales Flow | Sales Workflow | Close deal, collect deposit authorization |
| Finance Flow | Finance Workflow | Collect deposit, process payments |
| Execution Flow | Execution Workflow | Schedule and perform installation work |

### 5.3 Sales Flow (Initiating Flow)

**Node List:**

| Node ID | Node Name | Entry Node | Completion Rule |
|---------|-----------|------------|-----------------|
| S1 | Qualify Lead | Yes | ALL_TASKS_DONE |
| S2 | Present Proposal | No | ALL_TASKS_DONE |
| S3 | Close Deal | No | ALL_TASKS_DONE |

**Key Task in S3:**

| Task ID | Task Name | Allowed Outcomes | Cross-Flow Dependency |
|---------|-----------|------------------|-----------------------|
| S3.1 | Collect Signature | SIGNED, DECLINED | None |

**Gate Routing:**

*Tasks emit outcomes; gates route node-level outcomes.*

| Source Node | Outcome | Target |
|--------|---------|--------|
| S3 | SIGNED | (Terminal + Fan-Out Rule) |
| S3 | DECLINED | (Terminal) |

**Fan-Out Rule (authored in Builder):**  
On S3.1 = SIGNED → Instantiate Finance Flow AND Execution Flow into same Flow Group.

### 5.4 Finance Flow

**Node List:**

| Node ID | Node Name | Entry Node | Completion Rule |
|---------|-----------|------------|-----------------|
| F1 | Collect Deposit | Yes | ALL_TASKS_DONE |
| F2 | Process Balance | No | ALL_TASKS_DONE |

**Tasks:**

| Node | Task ID | Task Name | Allowed Outcomes | Cross-Flow Dependency |
|------|---------|-----------|------------------|-----------------------|
| F1 | F1.1 | Collect Deposit | DEPOSIT_COLLECTED, DEPOSIT_FAILED | None |
| F2 | F2.1 | Collect Balance | BALANCE_COLLECTED, BALANCE_FAILED | Execution Flow: "Complete Installation" = INSTALLATION_COMPLETE |

**Gate Routing:**

*Tasks emit outcomes; gates route node-level outcomes.*

| Source Node | Outcome | Target |
|--------|---------|--------|
| F1 | DEPOSIT_COLLECTED | F2 |
| F1 | DEPOSIT_FAILED | (Terminal - Failed) |
| F2 | BALANCE_COLLECTED | (Terminal - Success) |
| F2 | BALANCE_FAILED | (Terminal - Failed) |

### 5.5 Execution Flow

**Node List:**

| Node ID | Node Name | Entry Node | Completion Rule |
|---------|-----------|------------|-----------------|
| E1 | Schedule Installation | Yes | ALL_TASKS_DONE |
| E2 | Perform Installation | No | ALL_TASKS_DONE |
| E3 | Complete Installation | No | ALL_TASKS_DONE |

**Tasks:**

| Node | Task ID | Task Name | Allowed Outcomes | Cross-Flow Dependency |
|------|---------|-----------|------------------|-----------------------|
| E1 | E1.1 | Schedule Date | SCHEDULED | Finance Flow: F1.1 = DEPOSIT_COLLECTED |
| E2 | E2.1 | Perform Work | WORK_COMPLETE, WORK_FAILED | None |
| E3 | E3.1 | Complete Installation | INSTALLATION_COMPLETE | None |

**Gate Routing:**

*Tasks emit outcomes; gates route node-level outcomes.*

| Source Node | Outcome | Target |
|--------|---------|--------|
| E1 | SCHEDULED | E2 |
| E2 | WORK_COMPLETE | E3 |
| E2 | WORK_FAILED | E1 (reschedule loop) |
| E3 | INSTALLATION_COMPLETE | (Terminal) |

### 5.6 Cross-Flow Dependency Summary

| Dependent Task | Dependency |
|----------------|------------|
| Execution E1.1 "Schedule Date" | Finance F1.1 = DEPOSIT_COLLECTED |
| Finance F2.1 "Collect Balance" | Execution E3.1 = INSTALLATION_COMPLETE |

### 5.7 Execution Timeline (Illustrative)

| Step | Action | Actionable Tasks |
|------|--------|------------------|
| 1 | Sales Flow completes with SIGNED | (Sales Flow terminal) |
| 2 | Finance Flow and Execution Flow instantiated | F1.1 is Actionable; E1.1 is NOT Actionable (dependency unsatisfied) |
| 3 | Finance records F1.1 = DEPOSIT_COLLECTED | F2.1 NOT Actionable (dependency unsatisfied); E1.1 becomes Actionable |
| 4 | Execution records E1.1 = SCHEDULED | E2.1 becomes Actionable |
| 5 | Execution records E2.1 = WORK_COMPLETE | E3.1 becomes Actionable |
| 6 | Execution records E3.1 = INSTALLATION_COMPLETE | F2.1 becomes Actionable |
| 7 | Finance records F2.1 = BALANCE_COLLECTED | (Both Flows terminal) |

### 5.8 Key Observations

1. **Finance and Execution start simultaneously** but have different initial Actionability.
2. **No domain triggers another.** FlowSpec evaluates constraints and updates Derived State.
3. **Cross-flow coordination is bidirectional.** Finance waits for Execution; Execution waits for Finance.
4. **Work Station renders Tasks from multiple Flows.** It queries FlowSpec for Actionable Tasks across all Flows in the Flow Group.

### 5.9 Diagram (Conceptual)

```
                    [Sales Flow]
                         │
                         │ SIGNED
                         ▼
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
     [Finance Flow]            [Execution Flow]
            │                         │
     ┌──────┴──────┐           ┌──────┴──────┐
     │             │           │             │
  [F1: Collect  ]  │        [E1: Schedule]   │
  [   Deposit   ]  │           │             │
     │             │           │ (blocked    │
     │ DEPOSIT_    │           │  until F1   │
     │ COLLECTED   │           │  complete)  │
     │             │           │             │
     │ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─►│             │
     │             │           │ SCHEDULED   │
     │             │           ▼             │
     │             │        [E2: Perform]    │
     │             │           │             │
     │             │           │ WORK_       │
     │             │           │ COMPLETE    │
     │             │           ▼             │
     │             │        [E3: Complete]   │
     │             │           │             │
     │             │           │ INSTALL_    │
     │             │           │ COMPLETE    │
     │             │◄─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─│
     │             │           │             │
  [F2: Collect  ]  │           ▼             │
  [   Balance   ]  │       (Terminal)        │
     │             │                         │
     │ BALANCE_    │                         │
     │ COLLECTED   │                         │
     ▼             │                         │
 (Terminal)        └─────────────────────────┘

Legend:
─ ─ ─ ► Cross-Flow Dependency (actionability gate)
───────► Within-Flow Gate routing
```

---

## 6. Validation Against Invariants

Each example has been validated against the invariants defined in [20_flowspec_invariants.md](./20_flowspec_invariants.md):

| Invariant | Example A | Example B | Example C | Example D |
|-----------|-----------|-----------|-----------|-----------|
| INV-001: No Work Outside Tasks | ✓ | ✓ | ✓ | ✓ |
| INV-002: Explicit Outcomes Only | ✓ | ✓ | ✓ | ✓ |
| INV-003: Gates Route Only | ✓ | ✓ | ✓ | ✓ |
| INV-004: No Stage-Implied Readiness | ✓ | ✓ | ✓ | ✓ |
| INV-005: No Floating Evidence | ✓ | ✓ | ✓ | ✓ |
| INV-008: All Outcomes Routed | ✓ | ✓ | ✓ | ✓ |
| INV-014: Entry Node Required | ✓ | ✓ | ✓ | ✓ |
| INV-015: Terminal Path Exists | ✓ | ✓ | ✓ | ✓ |
| INV-017: Cross-Flow User-Authored | N/A | N/A | N/A | ✓ |
| INV-018: Domains Don't Trigger | N/A | N/A | N/A | ✓ |
| INV-020: Flow Start ≠ Actionability | N/A | N/A | N/A | ✓ |
| INV-021: Cross-Flow Scoped to Group | N/A | N/A | N/A | ✓ |

---

## 6. Anti-Examples (What NOT to Do)

### 6.1 Anti-Example: Implicit Stage Progression

**WRONG:**
```
Nodes: [Stage 1, Stage 2, Stage 3]
Behavior: When Stage 1 completes, Stage 2 automatically starts.
No Gate routing defined.
```

**Why Wrong:** Violates INV-004 (No Stage-Implied Readiness) and INV-012 (Graph-First Execution). Progression must be explicit via Gates.

### 6.2 Anti-Example: Freeform Outcomes

**WRONG:**
```
Task: "Review Document"
Outcomes: (user enters any text)
Recorded: "Looks fine I guess"
```

**Why Wrong:** Violates INV-002 (Explicit Outcomes Only). Gates cannot route unknown Outcomes.

### 6.3 Anti-Example: Gate Deciding Completion

**WRONG:**
```
Gate: "If T1.1 = PASS and T1.2 = PASS, mark N1 as complete"
```

**Why Wrong:** Violates INV-003 (Gates Route Only). Completion is determined by Node completion rules, not Gates.

### 6.4 Anti-Example: Floating Evidence

**WRONG:**
```
Evidence: "Project_Overview.pdf"
Attached To: (nothing — stored at Flow level for "reference")
```

**Why Wrong:** Violates INV-005 (No Floating Evidence). All Evidence must attach to a Task.

---

**End of Document**
