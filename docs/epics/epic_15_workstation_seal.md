# EPIC-15 — Work Station Execution Surface Seal

**Status:** DONE / SEALED  
**Canon Source:** `docs/canon/workstation/00_execution_surface_sealed.md`  
**Date Sealed:** 2026-02-01

---

## 1. Purpose

Resolve the "Governance vs. Behavior" split in the Work Station layer by implementing mechanical gates that enforce it as the sole, non-prioritizing, and side-effect-free execution surface for FlowSpec. Ensure that the "Canonical Set = Canonical Presentation" invariant cannot drift into local UI prioritization or unauthorized domain mutations.

---

## 2. Completed Work

### 2.1 Enforcement Debt Remediation (WS-ED-01 to WS-ED-05)
- **WS-ED-01 (Determinism):** Extracted `filter-logic.ts` and implemented `workstation_determinism.test.ts` to prove relative order preservation under filtering.
- **WS-ED-02 (Monopoly):** Implemented `guard_ws_monopoly_01.mjs` using token intersection (`/api/`, `flowspec`, `/flows/`) + mutation intent to prevent execution bypass.
- **WS-ED-03 (Side Effects):** Implemented `guard_ws_side_effects_01.mjs` with destination-based scanning to enforce the API allowlist.
- **WS-ED-04 (Semantics):** Integrated `guard_ui_sem_01` to prevent "permission/authorized" language from drifting into assignment UI.
- **Chore: Layout Surface promotion (main vs fullbleed):** Relocated `/workstation` to `(fullbleed)` group and extracted root container into `(main)`. Enforced via `docs/canon/ux/layout_surfaces_vs_pages_v1.md`.

### 2.2 Mechanical Hardening
- **Refactor:** Unified Work Station execution calls into `execution-adapter.ts` with prefix-based safety naming (`apiStartTask`, etc.) to survive boundary guards.
- **Shared Logic:** Moved Task Feed filter logic into a testable shared helper to ensure the test exercises real production code.

### 2.3 Documentation
- Created `docs/canon/workstation/00_execution_surface_sealed.md`.
- Updated `docs/canon/00_sealed_subsystems_index.md`.

---

## 3. Verification Artifacts

The seal is mechanically enforced by:

- **Auth Test (Primary):** `tests/lib/responsibility/workstation_determinism.test.ts` (Order preservation proof).
- **CI Guard:** `ci/guards/guard_ws_monopoly_01.mjs` (Execution monopoly).
- **CI Guard:** `ci/guards/guard_ws_side_effects_01.mjs` (Side-effect allowlist).
- **CI Guard:** `ci/guards/guard_ws_no_reorder_01.mjs` (No local sort).

---

## 4. What’s Deferred / Not Included

- **Cross-domain execution:** Complex multi-domain actions (e.g., executing a task that *also* performs a finance write) must be handled by FlowSpec fanout, not the Work Station.
- **Prioritization logic:** Any ranking of tasks beyond the canonical sort is explicitly out of scope for v1.0.
- **Notification dispatch:** UI-triggered notifications remain design-only.

---

## 5. Closure Notes

The Work Station v1.0 is now a "Dumb Execution Surface"—it is extremely reliable at presenting work in order and capturing outcomes, but it holds zero authority over the logic or the sequence of work. This sealing ensures that the Work Station cannot become a source of architectural drift as new domain-specific UIs are added to the platform.
