# Work Station Integrity & Data Semantics

**Document ID:** 26_workstation_integrity_and_semantics_v1  
**Status:** CANONICAL  
**Last Updated:** 2026-02-05  
**Scope:** Data integrity, mutation boundaries, and semantic health mapping.

---

## 1. Integrity Invariants

### WS-ORD-001: Order Identity
- **Statement:** Work Station MUST render tasks in the exact order provided by the FlowSpec API and MUST NOT reorder locally.
- **Rationale:** Ensures UI consistency with engine-level priority and prevents "jumping" tasks during data refreshes.
- **Enforcement:** `ci/guards/guard_ws_no_reorder_01.mjs` blocks `.sort()` and `orderBy` in workstation components. `tests/lib/responsibility/workstation_determinism.test.ts` verifies identity.

### WS-EXEC-001: Mutation Monopoly
- **Statement:** Mutations to FlowSpec task states (`/start`, `/outcome`, `/evidence`) are EXCLUSIVELY permitted from the Work Station or instantiation core (`src/lib/flowspec/instantiation/`).
- **Rationale:** Prevents "ghost executions" from unauthorized parts of the UI (e.g., Sales or Finance dashboards).
- **Enforcement:** `ci/guards/guard_ws_monopoly_01.mjs` blocks these API patterns and the `execution-adapter` outside allowed paths.

### WS-DATA-001: Identity-Blind Actionables
- **Statement:** The Actionable Task projection MUST NOT contain user identity tokens (userId, role) in its payload.
- **Rationale:** Enforces the Responsibility Layer as a metadata-only system and prevents identity leakage.
- **Enforcement:** `ci/guards/guard_act_purity_01.mjs` scans API routes for forbidden tokens. `ci/guards/guard_no_my_actionable_01.mjs` prevents "convenience" identity-locked endpoints.

### WS-IO-001: Side Effect Allowlist
- **Statement:** Work Station is restricted to an allowlist of API roots (`/api/flowspec/`, `/api/tenancy/me`, etc.). Direct calls to mutative domains (Finance, Sales, etc.) are forbidden.
- **Rationale:** Enforces domain isolation and ensures all business logic mutations flow through FlowSpec.
- **Enforcement:** `ci/guards/guard_ws_side_effects_01.mjs`.

---

## 2. Semantic Invariants

### WS-HLTH-001: Job Health Derivation
- **Statement:** Job health (RED/ORANGE/GREEN) is a deterministic derivation of task signals.
  - **RED:** Any blocking detour OR overdue urgent/high task.
  - **ORANGE:** Any overdue normal task, due-soon task, or missing evidence.
  - **GREEN:** All other states.
- **Rationale:** Provides a unified "Manager View" of risk across the dashboard.
- **Enforcement:** `dashboard-logic.ts` implementation of `useManagerDashboardData`.

### WS-UI-001: Non-Destructive View Filters
- **Statement:** Filters like "My Assignments" are view-only enrichment. They MUST NOT affect the underlying availability of tasks or the ability of a manager to execute any actionable item.
- **Rationale:** Managers must retain full situational awareness even when focused on their own tasks.
- **Enforcement:** `ManagerDashboard.tsx` tooltip and `filter-logic.ts` implementation.

---

**End of Document**
