# Work Station Selection & Execution Invariants

**Document ID:** 25_workstation_selection_execution_invariants_v1  
**Status:** CANONICAL  
**Last Updated:** 2026-02-05  
**Scope:** Selection state, URL synchronization, and Inline Execution behavior.

---

## 1. Selection Invariants

These rules ensure that the Work Station selection state is robust, predictable, and drift-proof.

### WS-SEL-001: URL-as-Truth
- **Statement:** The `task` and `flow` query parameters are the single source of truth for task selection. Selection state MUST be derived from these parameters.
- **Rationale:** Ensures browser history (back/forward) and page refreshes maintain the user's focus correctly.
- **Enforcement:** `ManagerDashboard.tsx` derives `selectedTask` via `useMemo` from `allActionableTasks` using `taskId` and `flowId` from the URL.

### WS-SEL-002: Single Writer
- **Statement:** `ManagerDashboard` is the only component authorized to mutate the selection query parameters.
- **Rationale:** Prevents race conditions and "ghost" selections caused by multiple components fighting over the URL.
- **Enforcement:** `handleTaskSelect` in `ManagerDashboard.tsx` is the sole entry point for selection updates. `TaskFeed` triggered via callback only.

### WS-SEL-003: Inline Expand Execution
- **Statement:** Task execution occurs inline (accordion-style) within the task list. No separate "task detail" routes or pages are allowed.
- **Rationale:** Maintains user context within the dashboard lenses and reduces navigation latency.
- **Enforcement:** `TaskFeed.tsx` renders `TaskExecutionContent` directly below the selected task card.

### WS-SEL-004: Lens Change Clears Selection
- **Statement:** Switching lenses (tabs) MUST explicitly clear the `task` and `flow` parameters.
- **Rationale:** Prevents "stuck expansion" where a task from one lens remains open but invisible or out-of-context when switching to another lens.
- **Enforcement:** `handleLensChange` in `ManagerDashboard.tsx` calls `params.delete("task")` and `params.delete("flow")`.

### WS-SEL-005: Dead URL Cleanup
- **Statement:** If the URL contains a task key that no longer exists in the loaded dataset (e.g., completed or filtered out), the system MUST automatically clear the dead parameters.
- **Rationale:** Prevents "broken" UI states where the URL implies an active selection that the system cannot render.
- **Enforcement:** An `useEffect` hook in `ManagerDashboard.tsx` monitors `isLoading` and `selectedTask` to perform `router.replace` cleanup.

### WS-SEL-006: History Policy
- **Statement:** Intra-lens task toggles MUST use `router.replace` with `{ scroll: false }`. Lens changes and Job focus changes MUST use `router.push`.
- **Rationale:** Prevents the browser history from being polluted by multiple open/close toggles while preserving navigation for major context shifts.
- **Enforcement:** `handleTaskSelect` uses `replace`; `handleLensChange` and `handleClearJob` use `push`.

### WS-SEL-007: Single Shell / Content-Only Execution
- **Statement:** The execution component (`TaskExecutionContent`) MUST NOT render shell elements (Back buttons, `JobHeader`) or manage its own navigation state.
- **Rationale:** Enforces the "Single Work Station" architecture where `ManagerDashboard` provides all context and controls.
- **Enforcement:** `ci/guards/guard_ws_taskexecution_content_only.mjs` fails if forbidden imports or elements are detected.

---

## 2. Enforcement Hooks

| Hook | Purpose |
| :--- | :--- |
| `ci/guards/guard_ws_taskexecution_content_only.mjs` | Ensures execution component remains "content-pure". |
| `ci/guards/guard_ws_no_reorder_01.mjs` | Enforces deterministic ordering (WS-ORD-001). |
| `ci/guards/guard_ws_monopoly_01.mjs` | Enforces execution monopoly (WS-EXEC-001). |
| `ci/guards/guard_ws_side_effects_01.mjs` | Restricts API access to allowlist (WS-IO-001). |
| `ci/guards/guard_act_purity_01.mjs` | Prevents identity leakage in actionable tasks (WS-DATA-001). |
| `ci/guards/guard_no_my_actionable_01.mjs` | Blocks identity-specific convenience routes (WS-DATA-001). |
| `tests/lib/responsibility/workstation_determinism.test.ts` | Proves UI order matches API order. |

---

**End of Document**
