# Shell Boundary Contract

**Document ID:** 10_shell_contract  
**Status:** CANONICAL  
**Last Updated:** 2026-02-02  

---

## 1. Purpose

This document defines the structural and behavioral boundaries of the application shell (Navigation, Sidebar, Header). It ensures that global shell controls do not interfere with the execution context of specific routes.

### The "Why"
The application shell exists to provide orientation and navigation across the entire system. In contrast, surfaces like **Work Station** are "Sealed Execution Surfaces" where the lifecycle is driven by specific data requirements and user intent. When shell controls (like the application logo) trigger navigation into these surfaces unintentionally, they cause redundant network fetches, re-hydrate execution state prematurely, and break the spatial mental model of the user. Maintaining a strict boundary ensures that entering an execution surface is always a deliberate, user-initiated action.

---

## 2. Shell vs. Execution Boundary

### 2.1 Logo Behavior
The application logo in the sidebar is a **Shell Control**, not a navigation element.

- **MUST NOT** trigger route navigation (e.g., to `/workstation`).
- **MUST NOT** strip or modify existing URL search parameters.
- **MUST ONLY** expand the sidebar if it is currently collapsed.
- **MUST NOT** perform any action if the sidebar is already expanded.

**Rationale:** The logo is the primary recovery affordance for a collapsed sidebar. Wrapping it in a `Link` forces a full route re-hydration, triggering expensive network calls and layout recalculations (e.g., Work Station data fetching or FlowSpec canvas re-fits).

### 2.2 Collapsed Sidebar Geometry
The sidebar MUST maintain a strict geometric boundary when collapsed.

- **NO PROTRUSIONS:** Components within the sidebar header (e.g., collapse toggles) **MUST NOT** be rendered outside the sidebar's bounding box when `collapsed === true`.
- **FORBIDDEN PATTERN:** Using `absolute` positioning with horizontal translations (e.g., `translate-x-1/2`) to place controls into the `<main>` content plane.

**Rationale:** Protrusions into the content plane cause layout instability, overlapping controls, and incoherent spatial mapping for users.

---

## 3. Implementation Anchors

- **Component:** `AppSidebar` in `src/components/nav/app-sidebar.tsx`
- **Context:** `SidebarProvider` and `useSidebar` in `src/components/nav/sidebar-context.tsx`
- **Control:** Semantic `<button>` for the logo with keyboard support.
- **State:** `collapsed` state from `SidebarProvider`.

---

## 4. Regression Examples (Forbidden)

| Pattern | Rationale |
|---------|-----------|
| `<Link href="/workstation">` wrapping logo | Forces re-hydration of execution surfaces. |
| `absolute right-0 translate-x-1/2` on toggle | Leaks controls into the content plane. |
| Logo toggling sidebar (Close-on-click) | Logo should only ever "Open/Expand". |

---

## 5. Enforcement

Compliance is enforced via:
1. **Mechanical Guard:** `ci/guards/guard_shell_boundary_01.mjs`
2. **Regression Test:** `tests/nav/sidebar-logo.test.tsx`

---

**End of Document**
