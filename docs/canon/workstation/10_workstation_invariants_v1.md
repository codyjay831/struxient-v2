# Work Station Invariants v1

**Document ID:** 10_workstation_invariants_v1  
**Status:** CANONICAL  
**Last Updated:** 2026-02-04  
**Scope:** Work Station UI/UX and Dashboard behavior.

---

## 1. Purpose

This document locks the canonical invariants for the Work Station v1. These invariants ensure that the Work Station remains a focused decision and execution hub, preventing it from drifting into a generic task dump or a passive reporting dashboard.

---

## 2. Locked Invariants

### INV-WS-01: Critical Attention is always visible and capped
- **Statement:** Must be visible on initial load; capped at 10; overflow via “+ N more” route to filtered lens.
- **Rationale:** Prevents cognitive overload and ensures managers focus on the most urgent items first.
- **UX Implication:** A dedicated, prominent section at the top of the dashboard that never disappears.
- **Testability Notes:** Can be enforced via UI component tests (checking max item count) and visual regression tests.

### INV-WS-02: Everything shown is actionable
- **Statement:** Each surfaced item has a next action (open decision/execution/resolve/assign/approve); no pure reporting widgets.
- **Rationale:** Work Station is an execution surface, not a BI tool. If it's on the screen, the user must be able to do something about it.
- **UX Implication:** Every card or table row must have a primary action button or a clear "Next Step" path.
- **Testability Notes:** CI guards can check for the presence of action triggers (buttons/links) in dashboard components.

### INV-WS-03: Tabs are lenses with tab-relevant alerts/actions
- **Statement:** Each tab changes lens and surfaces at least one top-of-tab alert when applicable; no empty/duplicate tabs.
- **Rationale:** Tabs should provide unique perspectives (Calendar vs Jobs vs Tasks) and proactively highlight issues specific to that perspective.
- **UX Implication:** Switching tabs doesn't just change the view; it changes the "Signals" relevant to that view.
- **Testability Notes:** Integration tests can verify that switching tabs updates the "Alert" banner or Signal strip.

### INV-WS-04: Safe Navigation vs Execution is explicitly separated
- **Statement:** Visual/structural separation with READ ONLY vs EXECUTION labeling.
- **Rationale:** Users must know when they are looking at data (Safe) versus when they are about to change state (Execution).
- **UX Implication:** Clear labels (e.g., "READ ONLY" vs "EXECUTION") on links and buttons, often separated into different UI regions (like the right rail).
- **Testability Notes:** Linter or component-level checks can enforce the presence of these labels on navigation elements.

### INV-WS-05: No infinite scroll dumps; group by time horizon and signal
- **Statement:** Must group by Today/Tomorrow/This Week and signal categories; “show more” routes out.
- **Rationale:** Prevents "the scroll of death" and forces organization by urgency and category.
- **UX Implication:** Use of columns or discrete sections for time-based grouping; "View All" links instead of infinite scroll.
- **Testability Notes:** UI tests can verify that task lists are paginated or capped and that grouping logic is present.

### INV-WS-06: Manager view surfaces managerial work only
- **Statement:** Prioritize approvals/assignments/exceptions/escalations/conflicts/customer response gaps; not worker task dumps.
- **Rationale:** Managers should not be buried in individual worker tasks; they need to see where the system is failing or requires a decision.
- **UX Implication:** Filtering logic that defaults to high-level exceptions and required approvals.
- **Testability Notes:** Verify that default dashboard queries include manager-specific filters (e.g., `needsApproval=true`).

### INV-WS-07: Health ≠ task volume; Orange/Red means attention required
- **Statement:** Green may have tasks; Orange/Red require attention; “Needs Decision” filter is separate from health.
- **Rationale:** A job with 100 green tasks is "Healthier" than a job with 1 red task. Health indicates blockages, not volume.
- **UX Implication:** Use of color-coded "Health Dots" that reflect blockers and risks, not just task completion percentage.
- **Testability Notes:** Unit tests for health computation logic ensuring it prioritizes "Blocked" signals over "Remaining Task" counts.

---

## 3. Non-Goals (Work Station v1)

- **Not a CRM:** Work Station is not for managing customer relationships; it only surfaces customer communication gaps.
- **Not a Gantt Chart:** While it has a Calendar lens, it is not a full-featured project scheduling tool.
- **Not an Analytics Suite:** It surfaces bottlenecks but does not provide deep-dive historical reporting.
- **No Worker-Level Task Tracking:** Workers have their own views; Manager view is for exceptions and approvals.

---

## 4. Drift Risks

1. **Widget Bloat:** Adding "nice-to-have" charts that aren't actionable (Violates INV-WS-02).
2. **Infinite Scroll Adoption:** Switching to infinite scroll for "ease of use" (Violates INV-WS-05).
3. **Implicit Execution:** Buttons that trigger state changes without clear "EXECUTION" labeling (Violates INV-WS-04).
4. **Color as Status:** Using Red/Green to show % complete instead of health/blockers (Violates INV-WS-07).
5. **Worker Task Dumping:** Including every granular task in the manager's "Today" view (Violates INV-WS-06).

---

## 5. Verified In Practice

The Work Station Manager Dashboard v1 has been fully implemented and verified against these invariants (Phases 0–5).

- **Mechanical Enforcement:**
  - Critical Attention capped at 10 via `.slice(0, 10)` in `OverviewLens`.
  - Time Horizon groupings (Today/Tomorrow/Week) enforced in `dashboard-logic.ts`.
  - Health mapping (INV-WS-07) implemented as a pure function of derived signals.
  - Right rail explicitly separated with `READ ONLY` and `EXECUTION` badges.
- **Test Proof:**
  - `tests/components/workstation-manager-dashboard-phase1.test.tsx` (all 12 tests passing).

---

**End of Document**
