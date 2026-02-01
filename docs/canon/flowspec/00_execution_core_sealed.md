# FlowSpec Execution Core v1.0 — SEALED SUBSYSTEM

## 1. Seal Declaration

The FlowSpec Execution Core (Version 1.0) is formally implemented, verified, and sealed. This subsystem is the authoritative engine for workflow execution, truth persistence, and actionability computation. It serves as the system's "Gravity Well," where state transitions are atomic and deterministic.

**Status:** SEALED  
**Version:** 1.0  
**Date Sealed:** 2026-02-01  
**Scope:**
- `src/lib/flowspec/engine.ts` (Operations & Coordination)
- `src/lib/flowspec/truth.ts` (Atomic Persistence)
- `src/lib/flowspec/derived.ts` (Deterministic Computation)

---

## 2. Sealed Invariants

The following invariants are mechanically locked and enforced by CI guards:

### 2.1 Atomic recordOutcome Transaction
- **Atomicity:** `engine.recordOutcome` performs all core state transitions—persisting the task outcome, activating downstream nodes, and updating flow status—within a single `prisma.$transaction`.
- **Integrity:** Partial progress is impossible. If routing or status updates fail, the entire execution progress (including the outcome) rolls back to the prior state.

### 2.2 Execution Purity (No Side Effects in TX)
- **Isolation:** Side effects such as Fan-Out instantiation, notification dispatch, or external network calls MUST NOT occur inside the database transaction.
- **Resilience:** Side effects are triggered post-commit and are best-effort/retryable; their failure does not invalidate the committed execution truth.

### 2.3 Single Execution Timestamp
- **Consistency:** All writes within an atomic unit (e.g., `recordOutcome` or `instantiateFlow`) use a single, shared `now` timestamp passed from the coordination layer (engine) to the persistence layer (truth).
- **Auditability:** Related events (Outcome, NodeActivation, FlowCompletion) share identical timestamps for precise sequence reconstruction.

### 2.4 Derived Purity & Determinism
- **Immutability:** Truth records are append-only. Outcomes, once recorded, cannot be changed (INV-007).
- **Canonical Sort:** Actionable task sets are deterministically sorted by `flowId ASC`, `taskId ASC`, and `iteration ASC` (Fix #1).
- **Hydration Stability:** Truth queries use `id: "asc"` as a secondary tie-breaker to ensure stable hydration regardless of database timestamp precision.

---

## 3. CI Enforcement & Verification

The following mechanical gates block any merge that violates these invariants:

### 3.1 CI Guards
- **`ci/guards/guard_fs_trans_core.mjs`**: Enforces that all `recordOutcome` mutations are wrapped in a transaction.
- **`ci/guards/guard_fs_no_external_in_tx.mjs`**: Enforces that forbidden side-effect tokens (e.g., `executeFanOut`) are excluded from transaction blocks.
- **`ci/guards/guard_fs_iso_01.mjs`**: Protects the core from domain-bleed (e.g., importing Responsibility or UI logic).

### 3.2 Automated Tests
- **`tests/lib/flowspec/atomicity.test.ts`**: Proves atomicity by simulating a routing failure and asserting full rollback of outcome and node activations.
- **`tests/lib/flowspec/phase3_guards.test.ts`**: Verifies canonical sorting and metadata-agnostic actionable sets.
- **`tests/lib/flowspec/hydration_equivalence.test.ts`**: Verifies hydration stability across varied record orders.

---

## 4. Change Control Rule

Any modification to a SEALED subsystem requires:
1. **Seal Breach Proposal:** A formal RFC explaining the necessity of the change.
2. **passing guards/tests:** All existing atomicity, isolation, and sorting guards must remain green.
3. **Explicit Canon Guardian Approval.**

---

## 5. Public API (Entry Points)

| Function | Role | side effects |
|---|---|---|
| `startTask` | Begin a task | YES (Write) |
| `recordOutcome` | Finish a task (Atomic) | YES (Write) |
| `attachEvidence` | Evidence upload | YES (Write) |
| `getActionableTasks` | Primary Query (Sorted) | NO |
| `isTaskActionable` | State Check | NO |
