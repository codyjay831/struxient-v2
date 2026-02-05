# Implementation Plan: Work Station Manager Dashboard v1

**Document ID:** plan_workstation_manager_dashboard_v1  
**Status:** COMPLETED  
**Date:** 2026-02-04  
**Author:** AI Coding Assistant

---

## 7. Completion Summary

The Work Station Manager Dashboard v1 has been fully implemented across 6 phases (0–5).

### Delivered:
- **Phase 0 (Shell):** 3-pane layout, horizontal lens switcher, right context rail.
- **Phase 1 (Exceptions):** Dynamic Signals Strip and capped Critical Attention grid (max 10).
- **Phase 2 (Horizon):** Today/Tomorrow/Week panels derived from real task deadlines.
- **Phase 3 (Lenses):** Proactive alert banners for all non-Overview tabs; URL-driven state sync.
- **Phase 4 (Health):** Risk-prioritized Job Health table with "Needs Decision" filtering.
- **Phase 5 (Comms):** Read-only Customer Messages surface with honest placeholder contract.

### Intentionally Deferred:
- **Bidirectional Comms:** Awaiting full Comms domain implementation.
- **Worker View:** Deferred to v2 implementation.
- **Real-time Push:** v1 uses manual/event-based refresh only.

### Final Verification:
- All 7 **Work Station Invariants v1** verified in code and tests.
- **Zero left nav changes** confirmed.
- `npm run typecheck` passes cleanly.
- `tests/components/workstation-manager-dashboard-phase1.test.tsx` (12/12 passing).

---

## 1. Intent Restatement
Translate the `workstation_manager_dashboard.html` visual prototype into a production-ready Next.js App Router implementation using shadcn/ui. The goal is to establish a high-density, decision-first surface for Managers while strictly enforcing the Work Station Invariants v1. This implementation will live within the existing Work Station page (`src/app/(app)/(fullbleed)/workstation/page.tsx`).

## 2. Non-Goals
- **No left nav changes**: Absolutely no edits to `AppSidebar`, `appNav.ts`, or any sidebar-related layout properties.
- **No backend schema changes**: Data must be derived from existing Prisma models or identified in discovery.
- **No worker-level task views**: Manager view prioritizes exceptions and decisions, not granular completion.
- **No real-time WebSockets**: Initial phases will use polling or manual refresh.

## 3. Visual Authority
The prototype `workstation_manager_dashboard.html` is the authoritative source for:
- **Three-pane layout**: Main dashboard content with internal tabs and a dedicated right context rail.
- **Section Ordering**: Signals Strip -> Critical Attention -> Time Horizon Panels -> Job Health Table.
- **Labels & Semantics**: Specific naming for signals (Blocked, At Risk, etc.) and health statuses (Red/Orange/Green).
- **Right Rail Content**: Explicit separation of "Safe Navigation" (READ ONLY) and "Recommended Next" (EXECUTION).
- **Internal Tabs (Lenses)**: Overview, Calendar, Jobs, Tasks, Crews & Employees, Analytics.

## 4. Data Mapping Inventory

| Dashboard Element | Source Strategy | Source Details |
|-------------------|-----------------|----------------|
| **Signals Strip** | Derived | Counts from `ActionableTasks` and `JobAssignment` (FlowSpec/Responsibility). |
| **Critical Attention** | Derived | Top 10 tasks/exceptions with `isCritical` or `isBlocked` flag. |
| **Today/Tomorrow/Week**| Derived | Task `dueDate` or `targetCompletion` from `FlowSpec`. |
| **Job Health Table** | Derived | `FlowGroup` status mapped to health dots based on blocker presence. |
| **Safe Navigation** | Existing | Links to `src/app/(app)/(main)/customers/[id]` and `jobs/[id]`. |
| **Recommended Next** | Existing | Actions triggering `TaskExecution` overlays or assignment routes. |
| **Customer Messages** | **Discovery** | Requires existing source investigation (Comms/CRM). Stub in v1. |
| **Lens Alerts** | Derived | Tab-specific queries (e.g., Calendar conflicts, Crew gaps). |

## 5. End-to-End Phases

### Phase 0: Work Station Shell & Internal Lenses
- **Goal**: Establish the page structure and internal tab navigation within the existing Work Station route.
- **UI Deliverables**: 
  - Main content area with horizontal tab switcher (Overview, Calendar, etc.).
  - Right context rail with Safe Navigation vs Execution headers.
  - Sidebar remains untouched.
- **Data Strategy**: Hardcoded stub fixtures for all sections.
- **Acceptance Criteria**: 
  - Internal tabs switch lenses correctly without refreshing the page.
  - Satisfies **INV-WS-03** (Tabs as lenses) and **INV-WS-04** (Safe vs Execution separation).
- **Out-of-Scope Protection**: **NO LEFT NAV CHANGES.**

### Phase 1: Signals Strip & Critical Attention
- **Goal**: Implement the primary exception indicators and high-priority decision grid.
- **UI Deliverables**:
  - Signals Strip component with dynamic counts.
  - Critical Attention Grid (max 10 cards) with primary action buttons.
- **Data Strategy**: Initial derivation from `ActionableTasks` API.
- **Acceptance Criteria**:
  - Critical grid never exceeds 10 items (**INV-WS-01**).
  - Every card has a clear action button (**INV-WS-02**).
- **Out-of-Scope Protection**: **NO LEFT NAV CHANGES.**

### Phase 2: Time Horizon panels
- **Goal**: Group upcoming work by temporal urgency.
- **UI Deliverables**: Today, Tomorrow, and This Week columns/panels.
- **Data Strategy**: Simple grouping logic based on Task due dates.
- **Acceptance Criteria**: 
  - No infinite scroll; discrete panels with "View All" routing (**INV-WS-05**).
  - Manager-relevant items prioritized over granular tasks (**INV-WS-06**).
- **Out-of-Scope Protection**: **NO LEFT NAV CHANGES.**

### Phase 3: Lens-Specific Top Alerts
- **Goal**: Enable proactive alerts for non-overview tabs.
- **UI Deliverables**: Alert banners at the top of Calendar, Jobs, Tasks, and Crews tabs.
- **Data Strategy**: Mocked alerts for Phase 3, wired to specific gap-detection queries.
- **Acceptance Criteria**: 
  - Each tab surfaces at least one lens-relevant alert when applicable (**INV-WS-03**).
- **Out-of-Scope Protection**: **NO LEFT NAV CHANGES.**

### Phase 4: Job Health Table
- **Goal**: Comprehensive view of all active jobs.
- **UI Deliverables**: Tabular view with filters for Red/Orange/Green and "Needs Decision".
- **Data Strategy**: Derive health from blocker counts and risk signals.
- **Acceptance Criteria**: 
  - Health dot colors correctly reflect blockers, not just task volume (**INV-WS-07**).
- **Out-of-Scope Protection**: **NO LEFT NAV CHANGES.**

### Phase 5: Customer Messages & Comms Discovery
- **Goal**: Integrate customer communication signals into the right rail.
- **UI Deliverables**: Unread message counts and preview snippets in the Right Rail.
- **Data Strategy**: Discovery task to identify real data source; stub until then.
- **Acceptance Criteria**: 
  - Messages surface gaps in customer response.
- **Out-of-Scope Protection**: **NO LEFT NAV CHANGES.**

## 6. Guardrails & Test Plan

### UI Enforcement (Playwright/Vitest)
- **Critical Cap (INV-WS-01)**: Test that the `CriticalAttentionGrid` length is `<= 10`.
- **Lens Alerts (INV-WS-03)**: Test that switching to the "Calendar" tab displays a `CalendarAlert` component when conflicts exist.
- **Safe Labels (INV-WS-04)**: Verify that links in the "Safe Navigation" section contain the `READ ONLY` text label.
- **Manager Priority (INV-WS-06)**: Verify dashboard items are filtered for manager-relevant types (Approvals, Detours, Gaps).

### CI Guards
- **Structure Check**: Mechanical check to ensure no new items added to `appNav.ts` as part of this feature work.
- **Purity Guard**: Ensure `AppSidebar` component remains unchanged in Git history for these PRs.

---

## Change Summary
- **Revised Phase Structure**: Aligned with user's specific Phase 0-5 guidance.
- **Strengthened Constraints**: Explicitly added "No left nav changes" to all goals and phases.
- **Visual Authority Mapping**: Detailed the authoritative sections from `workstation_manager_dashboard.html`.
- **Data Inventory**: Identified "requires discovery" for customer messages.
- **Invariant Linkage**: Mapped specific acceptance criteria to **INV-WS-01..07**.
