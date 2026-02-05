# FlowSpec Builder UX Invariants (v1)

**Document ID:** 43_flowspec_builder_ux_invariants  
**Status:** CANONICAL  
**Last Updated:** 2026-02-04  
**Related Documents:**
- [20_flowspec_invariants.md](./20_flowspec_invariants.md)
- [40_flowspec_builder_contract.md](./40_flowspec_builder_contract.md)
- [50_flowspec_builder_how_it_works.md](./50_flowspec_builder_how_it_works.md)

---

## 1. Purpose

This document locks the FlowSpec Builder UX to prevent drift and regression. These invariants are non-negotiable and MUST be enforced in all future modifications.

---

## 2. Invariants

### UX-001: Canvas-First Primary Workspace
**Statement:**  
The Canvas MUST remain the primary, central workspace for the FlowSpec Builder. 

**Rule:**  
The Canvas MUST NOT be occluded by floating Save/Commit UI, modal dialogs (except for explicit lifecycle transitions), or stacked panels that do not leave the canvas interactive.

### UX-002: Save Safety Boundary
**Statement:**  
All "Save Safety" controls (Commit, Discard, Draft History) MUST reside exclusively within the Right Session Sidebar.

**Rule:**  
There MUST NOT be any floating, absolute-positioned, or overlay "save bars" or "save strips" placed over the canvas.

### UX-003: Panel Rail Exclusivity
**Statement:**  
Lateral panels MUST be bound to their designated rails.

**Rules:**
- **Left Rail:** MUST host only "Nodes" and "Workflow Configuration" panels.
- **Right Rail:** MUST host only "Session / Draft / History" panels.
- Rails MAY be collapsed but MUST always leave a visible affordance (handle/spine) to re-open.

### UX-004: Inspector Overlay Priority
**Statement:**  
The Node/Edge Inspector MUST be implemented as a high-priority overlay (Sheet) that covers the lateral panels if necessary.

**Rule:**  
The Inspector MUST NOT be a fixed panel that permanently resizes the canvas workspace in a way that forces panning to read core content. It MUST overlay the rails/panels with a higher Z-index.

### UX-005: Top Bar Role (Informational + Lifecycle)
**Statement:**  
The Top Bar MUST remain minimal and focused on identity, status, and major lifecycle transitions (Validate/Publish).

**Rules:**
- The Top Bar MUST NOT contain editing tools, node palettes, or property inspectors.
- The Top Bar MUST provide immediate visibility into:
    - Current Workflow Name (compact)
    - Status Badge (DRAFT, VALIDATED, PUBLISHED)
    - Unsaved Change count (if in Draft)
    - Last Saved timestamp (if in Draft)

### UX-006: Interaction Hierarchy
**Statement:**  
Click priority MUST be strictly enforced to prevent canvas-capture of interface clicks.

**Rules:**
- UI Elements (Rails, Panels, Top Bar, Inspector) MUST always capture clicks intended for them.
- The Canvas MUST NOT capture clicks that occur within the bounding boxes of panels or rails.
- Clicking the background of the canvas MUST clear selection in the Inspector.

### UX-007: Immutability Visibility
**Statement:**  
When a workflow is in a non-editable state (PUBLISHED), the UI MUST explicitly indicate immutability.

**Rule:**  
A persistent, non-blocking banner or status indicator MUST be visible in the workspace area when a Published workflow is viewed, explaining that it cannot be modified.

---

**End of Document**
