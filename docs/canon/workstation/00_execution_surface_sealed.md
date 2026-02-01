# Work Station Execution Surface v1.0 — SEALED SUBSYSTEM

## 1. Seal Declaration

The Work Station Execution Surface (Version 1.0) is formally implemented, verified, and sealed. This subsystem acts as the sole client-side environment for FlowSpec task execution, maintaining a strict boundary between user interaction and execution authority. It ensures that the canonical presentation of work remains consistent with the FlowSpec core, regardless of user-specific assignments or filters.

**Status:** SEALED  
**Version:** 1.0  
**Date Sealed:** 2026-02-01  
**Scope:**
- `src/app/(app)/workstation/**` (UI Surface)
- `src/app/(app)/workstation/_lib/execution-adapter.ts` (API Bridge)
- `src/app/(app)/workstation/_lib/filter-logic.ts` (Shared View Logic)

---

## 2. Sealed Invariants

The following invariants are mechanically locked and enforced by CI guards and authoritative tests:

### 2.1 Execution Monopoly (WS-INV-01)
- **Sole Surface:** Work Station is the only authorized UI surface for triggering FlowSpec execution mutations (`startTask`, `recordOutcome`, `attachEvidence`).
- **Mechanical Block:** Direct calls to FlowSpec mutation APIs or use of the `execution-adapter` is strictly forbidden outside of the Work Station scope (and instantiation core).

### 2.2 Presentation Determinism (WS-INV-02)
- **Canonical Preservation:** Work Station strictly preserves the relative ordering of tasks as delivered by the FlowSpec Projection Layer.
- **No Local Reordering:** The UI is forbidden from imposing local priority ranking or sorting (e.g., via `.sort()`). 
- **View-Only Filtering:** Work Station may filter its view (e.g., "My Assignments"); it may not reduce the canonical actionable set server-side.

### 2.3 Side-Effect Isolation (WS-INV-03)
- **API Allowlist:** Work Station is restricted to an allowlist of API roots:
    - `/api/flowspec/` (Read + execution mutations)
    - `/api/tenancy/me` (Identity)
    - `/api/jobs/` (Context)
- **Domain Separation:** Work Station is forbidden from directly mutating other domains (Finance, Scheduling, Sales, Admin) from within the task feed or execution components.

### 2.4 Governance Boundaries
- **No Execution Authority:** Work Station has no authority to validate state transitions or outcome logic; it is a view/input layer only.
- **Truth Anchor:** All truth mutations occur via FlowSpec APIs under sealed Execution Core invariants.

---

## 3. CI Enforcement & Verification

The following mechanical gates block any merge that violates these invariants:

### 3.1 CI Guards (Secondary Lint)
- **`ci/guards/guard_ws_monopoly_01.mjs`**: Enforces the execution monopoly by scanning for mutation patterns outside authorized paths.
- **`ci/guards/guard_ws_no_reorder_01.mjs`**: Scans for forbidden reordering mechanisms (`.sort()`, `orderBy`, etc.) in the workstation directory.
- **`ci/guards/guard_ws_side_effects_01.mjs`**: Enforces the side-effect allowlist via destination-based scanning of API paths.

### 3.2 Automated Tests (Primary Enforcement)
- **`tests/lib/responsibility/workstation_determinism.test.ts`**: **Primary Gate.** Proves that both unfiltered and filtered views preserve the relative canonical order using an adversarial sentinel fixture. Imports production logic from `filter-logic.ts`.

---

## 4. Change Control Rule

Any modification to a SEALED subsystem requires:
1. **Seal Breach Proposal:** A formal RFC explaining the necessity of the change.
2. **Passing Guards/Tests:** All existing monopoly, determinism, and side-effect guards must remain green.
3. **Explicit Canon Guardian Approval.**

---

## 5. UI Semantics (v1.0)

| Concept | UI Language Rule | Semantic Enforcement |
|---|---|---|
| **Assignment** | "Assigned to [Name]" | Purely advisory indicator. |
| **Filter** | "Filter: My Assignments" | Must appear near "My Assignments" to indicate non-gating nature. |
| **Execution** | "Record Outcome" | Triggers sealed FlowSpec core logic. |
| **Bypass** | "Show All Tasks" | Escape hatch always available to any tenant member. |
