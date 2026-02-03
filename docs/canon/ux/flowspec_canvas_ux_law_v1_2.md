# Struxient Workflow Builder — UX Law v1.2

**Status:** CANONICAL  
**Last Updated:** 2026-02-02  
**Version:** 1.2 (Governance Lock)  
**Supersedes:** [v1.1](./flowspec_canvas_ux_law_v1_1.md)  
**Related Documents:** [Interaction Postmortem](../epics/postmortem_01_flowspec_builder_canvas_interaction.md)

---

## 1. Hierarchy of Needs
Orientation **MUST** take precedence over configuration.
1. **Understanding** (What is this workflow?)
2. **Orientation** (Where am I?)
3. **Navigation** (How do I move?)
4. **Configuration** (How do I change details?)
5. **Editing** (How do I change structure?)

## 2. Overlay Law (Zero-Reflow)
The canvas is the primary orientation surface and **MUST** remain stable at all times.
- Inspectors and configuration panels **MUST** be out-of-flow overlays (e.g., Sheets, Modals).
- Opening or closing any inspector **MUST NOT** trigger a layout reflow or resize of the canvas container.
- *Evidence: `getBoundingClientRect()` of canvas container must remain identical (x, y, w, h).*

## 3. Truth Boundary Law
- **Canvas is a Projection**: It **MUST NOT** own state or execution logic. It only renders a projection of FlowSpec topology.
- **Inspector is Truth**: All semantic details, editing, and engine explanations **MUST** live in the inspector.
- **Strict Isolation**: Canvas components (`src/components/canvas/**`) **MUST NOT** import engine internals (`@/lib/flowspec/engine`, `truth`, `derived`).

## 4. No-Semantic-Drift Law
The UI **MUST NOT** lie about engine behavior.
- **Forbidden Terms**: Do not use "reset", "retry", "rollback", "rewind", "redo", or "start over" unless explicitly defined by FlowSpec engine. Prefer "Re-entry", "Attempt", "Preserved state".
- **No Inference**: Layout algorithms **MUST NOT** use outcome labels (e.g., "Success") to infer visual priority or "Happy Path". Spine selection **MUST** be deterministic and topology-only.

## 5. Default State Law
A workflow **MUST** be understandable within 3 seconds of opening.
- **Default Entry**: Canvas **MUST** be the primary surface on load.
- **Panel Suppression**: All inspectors, configuration drawers, and secondary sidebars **MUST** be closed by default.
- **Zoom-to-Fit**: The canvas **MUST** initialize to a zoom-to-fit state covering the full workflow.

## 6. Canvas Interaction & Rendering Laws
These laws preserve interaction fidelity and prevent state-fighting in CAD-style canvases.

### A. Screen-Space vs World-Space Responsibility
- **Law**: Orientation patterns (grid dots) **MUST** be rendered in screen-space (CSS `background-image`). Data elements (nodes, edges) **MUST** be rendered in world-space (SVG transforms).
- **Why**: Grid dots must remain fixed size and crisp regardless of zoom level. Zooming grid dots causes visual noise and "CAD motion sickness."
- **Failure**: SVG `<pattern>` grids that scale with the camera.

### B. Gesture Exclusivity (Monopoly Law)
- **Law**: Every gesture (pointerdown → pointermove → pointerup) **MUST** have exactly one owner. Background panning, node dragging, and node/edge selection are mutually exclusive.
- **Why**: Simultaneous panning and dragging leads to unpredictable node displacement and "slippery" interaction.
- **Failure**: Panning the camera while a node is being moved.

### C. Pointer vs Click Arbitration
- **Law**: Container-level `onClick` handlers **MUST** be guarded via target inspection (`e.target.closest`).
- **Why**: The browser synthesizes a `click` event after `pointerup`. If a node click selects a node, the bubbling `click` must not trigger a background "deselect" handler. `stopPropagation()` on pointer events alone is insufficient to stop synthetic clicks.
- **Failure**: Node Inspector opening then immediately closing (flicker) because the bubble-click cleared the selection.

### D. Inspector Stability Rule
- **Law**: An inspector **MUST NOT** be closed by the same gesture that opened it.
- **Why**: Predictability. Users must feel that selection is a deliberate, stable state change.
- **Failure**: Gesture disambiguation logic that fails to distinguish a "drag" from a "click," resulting in selection being cleared when the user intended to move a node.

---

## Changelog

### v1.2 (2026-02-02)
- Added **Section 6 (Canvas Interaction & Rendering Laws)** following the [FlowSpec Builder Canvas Interaction Failure](../epics/postmortem_01_flowspec_builder_canvas_interaction.md).
- Formalized screen-space vs world-space separation for grid rendering.
- Mandated gesture monopoly and synthetic click guarding.
- Added Inspector stability rules to prevent UI flicker.

### v1.1 (2026-01-28)
- Initial release.
- Defined Hierarchy of Needs and Truth Boundary Law.

---
*Failure to comply with these laws results in an immediate PR rejection.*
