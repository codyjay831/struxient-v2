# Sealed Subsystems Index

This document enumerates all Struxient subsystems that are formally **SEALED**.
A sealed subsystem is considered complete, stable, and non-negotiable without a
versioned re-proposal and canon approval.

---

## What “Sealed” Means

A SEALED subsystem satisfies all of the following:

- Canonical invariants are fully defined and enforced
- CI guards mechanically prevent drift
- UI semantics are aligned and verified
- Edge cases and abuse paths have been adversarially tested
- Deferred scope is explicitly documented
- The subsystem is safe to mentally “forget” during future work

Any modification to a SEALED subsystem requires:
1. A new version proposal (e.g., v2.2)
2. A scoped plan with drift analysis
3. Explicit approval before implementation

---

## SEALED SUBSYSTEMS

### 1. Responsibility / Assignment Layer — v2.1
**Status:** SEALED  
**Date Sealed:** 2026-02-01  
**Canon:** `docs/canon/responsibility/00_responsibility_layer.md`  
**Epic:** `EPIC-12 — Responsibility / Assignment Layer v2.1`

**Scope (Done):**
- Append-only job assignments
- Exactly-one assignee per slot invariant
- Tenant consistency (Job / Assigner / Assignee)
- Metadata-only enrichment (non-gating)
- Canonical actionable set preservation
- Client-side view filtering (Option A)
- CI-enforced isolation from FlowSpec execution

**Explicitly Not Included:**
- Groups / unions
- Permission-based execution gating
- Server-side “my tasks” endpoints
- Notification dispatch
- External auth / capabilities

**Change Rule:**  
Any future change requires Responsibility Layer v2.2 proposal.

---

### 2. FlowSpec Execution Core — v1.0
**Status:** SEALED  
**Date Sealed:** 2026-02-01  
**Canon:** `docs/canon/flowspec/00_execution_core_sealed.md`  
**Epic:** `docs/epics/epic_13_execution_core_seal.md`

**Scope (Done):**
- **Atomic Progress:** `recordOutcome` mutations wrapped in `$transaction` (Fix GAP-01).
- **Side Effect Isolation:** External calls (fanout) strictly outside transaction blocks.
- **Timestamp Consistency:** Single `now` timestamp propagated for all writes in a unit.
- **Deterministic Sort:** Actionable sets sorted by `flowId`, `taskId`, `iteration`.
- **Append-only Truth:** Outcome immutability (INV-007) and hydration stability.

**Explicitly Not Included:**
- Side effect outbox / reliable notification dispatch.
- Retroactive truth correction (v2.0).
- Any RBAC or assignment-based execution gating.

**Change Rule:**  
Any modification requires a Seal Breach Proposal + passing `guard_fs_trans_core` and `atomicity.test.ts`.

---

### 3. Actionable Projection Layer — v1.0
**Status:** SEALED  
**Date Sealed:** 2026-02-01  
**Canon:** `docs/canon/flowspec/01_actionable_projection_sealed.md`  
**Epic:** `docs/epics/epic_14_actionable_projection_seal.md`

**Scope (Done):**
- **Identity Purity:** Minimal projection of assignees (no userId/role).
- **No Reduction:** Identity-agnostic task sets (no server-side filtering).
- **Compute-First Enrichment:** Separation of engine core and metadata attachment.
- **Canonical Ordering:** Deterministic sort enforced in the derived-state layer (computeActionableTasks).
- **Purity Guarding:** Broad-spectrum CI scan for sensitive token leaks.

**Explicitly Not Included:**
- Prioritization or "My Tasks" server-side endpoints.
- Group/Team assignment support.
- Notification dispatch logic.

**Change Rule:**  
Any modification requires a Seal Breach Proposal + passing `guard_act_purity_01` and `actionable_purity.test.ts`.

---

## Subsystems Under Consideration (Not Sealed)

_None at this time._

---

## Notes

This index exists to prevent silent scope creep and architectural regression.
If a subsystem is not listed here, it is considered open for evolution.
