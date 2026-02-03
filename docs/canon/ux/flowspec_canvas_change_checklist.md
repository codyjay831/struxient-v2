# FlowSpec Canvas Change Checklist

**Purpose:** This operational checklist **MUST** be used before and after any modification to the FlowSpec Builder canvas (`src/components/canvas/workflow-canvas.tsx`). It enforces the [Canvas Interaction & Rendering Laws](./flowspec_canvas_ux_law_v1_2.md) and prevents regressions identified in the [Interaction Postmortem](../epics/postmortem_01_flowspec_builder_canvas_interaction.md).

---

## 1. Paint & Layering
- [ ] **Single Source of Grid:** The grid dots **MUST** be screen-space, rendered via CSS `.canvas-grid` on the HTML container.
- [ ] **SVG Purity:** The SVG layer **MUST NOT** render patterns, grids, or background paint that duplicates or obscures the CSS grid.
- [ ] **Transparency:** Ensure the SVG element and its immediate children (like the background click layer) remain transparent so the CSS background is visible.

## 2. Coordinate Spaces
- [ ] **World-Space Nodes:** Nodes and edges **MUST** be transformed within the primary `<g>` element using the camera state.
- [ ] **Zoom-Aware Deltas:** Manual movement (dragging) **MUST** convert screen-space deltas to world-space using `worldDelta = screenDelta / camera.k`.
- [ ] **Fixed-Scale Grid:** Verify the grid dots remain a fixed size (screen-space) and do not scale or blur during zoom.

## 3. Gesture Exclusivity (Monopoly Law)
- [ ] **One Owner per Gesture:** A single pointer interaction **MUST NOT** simultaneously trigger panning and dragging.
- [ ] **Drag Threshold:** Verify that `DRAG_THRESHOLD_PX` (5px) correctly disambiguates a deliberate "click" from a "drag start."
- [ ] **Capture Phase:** Ensure `setPointerCapture` is used on the active element to prevent event loss during high-speed movement.

## 4. Event Arbitration
- [ ] **Guarded onClick:** The container-level `onClick` (background deselect) **MUST** inspect `e.target` and return early if the click originated from a node or edge.
- [ ] **Synthetic Click Defense:** Account for the browser's synthetic `click` event that fires after `pointerup`. `stopPropagation` on pointer events alone is insufficient to block this bubble.

## 5. Inspector Stability
- [ ] **Gesture Isolation:** Selecting a node **MUST NOT** be immediately reversed by the same gesture's bubbling click event.
- [ ] **Mutual Exclusivity:** Ensure "select node" and "clear selection" handlers cannot both execute from a single physical click.

---

## 6. Manual Regression Checklist
Before submitting a PR, verify the following in the browser:
- [ ] **Node Click:** Tapping a node opens the Inspector and it **STAYS** open.
- [ ] **Node Drag:** Dragging a node moves the node; the Inspector does **NOT** flash or open.
- [ ] **Background Pan:** Clicking empty space and moving pans the camera; nodes do **NOT** move relative to the world.
- [ ] **Zoom:** Mousewheel zooming scales nodes/edges but grid dots remain fixed and crisp.
- [ ] **Fidelity:** No "double dots" or ghosting layers visible in the background.

## 7. Explicit "DO NOT" List
- **DO NOT** reintroduce `<pattern>` tags for the grid inside the SVG.
- **DO NOT** add unconditional `onClick` handlers to the canvas container without `e.target` guards.
- **DO NOT** mix `MouseEvent` and `PointerEvent` logic without explicit capture/release cycles.
