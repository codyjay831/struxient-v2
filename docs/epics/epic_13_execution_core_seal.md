# EPIC-13 — FlowSpec Execution Core Seal

**Status:** DONE / SEALED  
**Canon Source:** `docs/canon/flowspec/00_execution_core_sealed.md`  
**Date Sealed:** 2026-02-01

---

## 1. Problem Statement (GAP-01)

Prior to sealing, the FlowSpec Execution Core suffered from an **Atomicity Breach (GAP-01)**. Specifically, `engine.recordOutcome` performed three independent database writes (Outcome, Node Activation, Flow Status) without a transaction wrapper. A system crash or routing failure between these writes could leave a workflow in a "hung" state where a task was marked complete but downstream work was never activated.

---

## 2. Solution Summary

The execution core was hardened to ensure all state transitions are atomic and deterministic:

- **Atomic Unit of Progress:** Wrapped `recordOutcome` in a `prisma.$transaction`.
- **Transaction Propagation:** Updated `truth.ts` helpers to accept a transaction client (`tx`) and a shared timestamp (`now`).
- **Side Effect Isolation:** Moved `executeFanOut` and other external side effects outside the transaction boundary to prevent DB lock contention.
- **Deterministic Sort:** Applied canonical sorting (`flowId`, `taskId`, `iteration`) to all actionable task queries.

---

## 3. Verification Artifacts

The seal is mechanically enforced by:

- **CI Guard:** `ci/guards/guard_fs_trans_core.mjs` (Ensures transaction usage in engine).
- **CI Guard:** `ci/guards/guard_fs_no_external_in_tx.mjs` (Ensures side effects are outside tx).
- **Integration Test:** `tests/lib/flowspec/atomicity.test.ts` (Proves rollback on failure).

---

## 4. What’s Deferred / Not Included

- **Notification Outbox:** Implementation of an asynchronous side-effect observer is deferred.
- **Fan-Out Reliability:** While isolated from the core transaction, a robust retry mechanism for failed fan-outs is not part of this seal.
- **RBAC / Responsibility Logic:** All assignment-based filtering and authorization logic remain strictly outside the execution core.
- **Correction Events (v2.0):** Mechanism for retroactive truth correction.

---

## 5. Closure Notes

The FlowSpec Execution Core v1.0 is now the foundational "Gravity Well" of the system. It is considered stable and complete. Any future work involving scheduling, finance, or advanced routing must orbit this core without modifying its internal atomicity or isolation rules.
