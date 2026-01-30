# Work Station Glossary

**Document ID:** 00_workstation_glossary  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [10_workstation_contract.md](./10_workstation_contract.md)
- [20_workstation_invariants.md](./20_workstation_invariants.md)
- [30_workstation_ui_api_map.md](./30_workstation_ui_api_map.md)
- [FlowSpec Glossary](../flowspec/00_flowspec_glossary.md)
- [FlowSpec Engine Contract](../flowspec/10_flowspec_engine_contract.md)

---

## 1. Purpose

This document defines terms specific to the Work Station domain. For FlowSpec-related terms (Task, Outcome, Evidence, Flow, etc.), see [FlowSpec Glossary](../flowspec/00_flowspec_glossary.md).

**Rule:** Work Station documentation MUST use FlowSpec terminology precisely. This glossary only defines Work Station-specific concepts.

---

## 2. Foundational Statement

> **The Work Station does not execute workflows; it exists solely to perform and submit human work (tasks) into FlowSpec.**

This statement is the canonical lock for Work Station. All Work Station design, implementation, and documentation MUST align with this boundary.

See: [FlowSpec Engine Contract §2.1](../flowspec/10_flowspec_engine_contract.md)

---

## 3. Work Station-Specific Terms

### 3.1 Work Station

**Definition:** Work Station is an execution surface — a user interface where humans perform Tasks and submit Outcomes and Evidence to FlowSpec.

**Clarification:**
- Work Station is NOT a workflow engine.
- Work Station is NOT an orchestrator.
- Work Station renders Tasks that FlowSpec has determined are Actionable.
- Work Station submits work results (Outcomes + Evidence) to FlowSpec.

**What Work Station Does:**
1. Queries FlowSpec for Actionable Tasks
2. Renders Tasks for human interaction
3. Collects user input (Evidence, Outcome selection)
4. Submits Outcomes and Evidence to FlowSpec

**What Work Station Does NOT Do:**
1. Compute Actionability
2. Decide sequencing
3. Unlock or advance work
4. Infer Outcomes
5. Mutate execution Truth directly

---

### 3.2 Execution Surface

**Definition:** An Execution Surface is a user-facing interface where work defined by FlowSpec is performed by humans or systems.

**Clarification:**
- Work Station is an Execution Surface.
- Sales, Finance, and Admin may also have Execution Surfaces.
- Execution Surfaces consume FlowSpec; they do not control it.
- All Execution Surfaces share the same relationship to FlowSpec: read Derived State, submit Outcomes.

- Execution Surfaces are NOT Projection Surfaces. They exist for action, 
  not historical lookup.
- Execution Surfaces MUST NOT cache Truth as authoritative.
- Execution Surfaces submit to FlowSpec; they do NOT record locally.

**Rule:** An Execution Surface is defined by its ability to submit Outcomes 
and Evidence. If a surface cannot submit, it is a Projection Surface.

---

### 3.3 Task Rendering

**Definition:** Task Rendering is the process of displaying an Actionable Task to a user in a form suitable for human interaction.

**Clarification:**
- Task Rendering is a UI concern, not a workflow concern.
- Rendered Tasks MUST be Actionable according to FlowSpec.
- Rendering includes: Task name, instructions, Evidence upload forms, Outcome buttons.
- Rendering does NOT include: sequencing logic, progress computation, unlock conditions.

---

### 3.4 Multi-Flow View

**Definition:** A Multi-Flow View is a Work Station interface that displays Actionable Tasks from multiple Flows within the same Flow Group.

**Clarification:**
- Work Station queries FlowSpec for all Actionable Tasks in a Flow Group.
- Tasks may originate from different Workflows (Sales-derived, Finance-derived, Execution-derived).
- The user sees a unified list; the underlying Flow structure is abstracted.
- FlowSpec determines which Tasks appear; Work Station only renders them.

---

### 3.5 Outcome Submission

**Definition:** Outcome Submission is the act of recording an Outcome on a Task by sending it to FlowSpec.

**Clarification:**
- Work Station collects the user's Outcome selection.
- Work Station calls FlowSpec's "Record Outcome" interface.
- FlowSpec validates and records the Outcome.
- Work Station does NOT record Outcomes locally or optimistically.

---

### 3.6 Evidence Attachment

**Definition:** Evidence Attachment is the act of uploading Evidence to a Task by sending it to FlowSpec.

**Clarification:**
- Work Station collects Evidence files/data from the user.
- Work Station calls FlowSpec's "Attach Evidence" interface.
- FlowSpec validates and attaches the Evidence.
- Evidence is attached before or at Outcome recording time (per Task requirements).

---

### 3.7 Stale Derived State

**Definition:** Stale Derived State is Actionability information that was accurate at query time but may no longer reflect current Truth.

**Clarification:**
- Work Station caches Actionable Task lists for display.
- Between query and user action, another user or system may record an Outcome.
- When Work Station submits an Outcome, FlowSpec validates current Truth.
- If the Task is no longer Actionable, FlowSpec rejects the submission.
- Work Station must handle rejection gracefully (refresh, notify user).

---

### 3.8 Idempotency (Submission Context)

**Definition:** In Work Station context, Idempotency means that submitting the same Outcome twice does not create duplicate records or errors.

**Clarification:**
- If a network failure causes retry, the same submission should succeed or be recognized as duplicate.
- FlowSpec enforces idempotency via Outcome immutability (once recorded, cannot re-record).
- Work Station should use idempotency keys for Evidence uploads.
- Retry behavior is safe because FlowSpec rejects duplicate Outcome recordings.

---

## 4. Relationship to FlowSpec Terms

| Work Station Concept | FlowSpec Equivalent | Relationship |
|---------------------|---------------------|--------------|
| Task Rendering | Actionable Task | Work Station renders what FlowSpec marks Actionable |
| Outcome Submission | Record Outcome | Work Station submits; FlowSpec records |
| Evidence Attachment | Attach Evidence | Work Station uploads; FlowSpec attaches |
| Multi-Flow View | Flow Group | Work Station displays Tasks from a Flow Group |
| Stale State | Derived State | Derived State may change between query and action |

---

## 5. Prohibited Work Station Behaviors

The following behaviors are PROHIBITED in Work Station:

| # | Prohibited Behavior | Reason |
|---|---------------------|--------|
| 5.1 | Computing Actionability locally | Violates INV-019 (FlowSpec Evaluates Actionability) |
| 5.2 | Displaying non-Actionable Tasks as workable | Creates false user expectations |
| 5.3 | Inferring Outcomes from user behavior | Violates INV-002 (Explicit Outcomes Only) |
| 5.4 | Directly mutating Flow state | Violates INV-009 (FlowSpec Owns Truth) |
| 5.5 | Triggering other domains | Violates INV-018 (Domains Don't Trigger) |
| 5.6 | Caching Outcomes locally as authoritative | Derived State is non-authoritative |
| 5.7 | Advancing or unlocking work | Work Station submits; FlowSpec advances |

---

## 6. Glossary Index

| Term | Section |
|------|---------|
| Evidence Attachment | 3.6 |
| Execution Surface | 3.2 |
| Idempotency | 3.8 |
| Multi-Flow View | 3.4 |
| Outcome Submission | 3.5 |
| Stale Derived State | 3.7 |
| Task Rendering | 3.3 |
| Work Station | 3.1 |

---

**End of Document**
