# Postmortem: FlowSpec Builder Canvas Interaction Failure & Resolution

**Date:** 2026-02-02  
**Status:** Resolved  
**Incident Scope:** FlowSpec Builder Canvas  

## Symptoms
1. **"Too Black" Background:** The canvas background was visually indistinguishable from pure black (#000), making it impossible to see depth or separation from the sidebar/edges.
2. **Missing/Duplicated Grid Dots:** Grid dots were either invisible or rendering incorrectly. Investigation revealed both an SVG pattern grid and a CSS grid were competing, with the SVG version zooming and losing fidelity.
3. **Node/Pan Conflict:** Dragging a node would simultaneously pan the canvas camera, making precise positioning impossible.
4. **Inspector Flicker:** Clicking a node would open the Node Inspector, which would then immediately close. This made it impossible to edit node details via the canvas.

## Root Causes
1. **Layering & Transparency:** The SVG layer lacked a solid background paint, causing the underlying (but incorrectly styled) container background to show through. The lack of semantic token adoption at the layout level meant hardcoded "black" was being used in several wrappers.
2. **Coordinate System Conflation:** Grid dots were being rendered in SVG "World Space" (inside the zoomable `<g>` tag), causing them to zoom and scale. They should have been in "Screen Space" (CSS background).
3. **Event Bubbling & Synthesis:** 
    - The Node Inspector flicker was caused by the browser's synthetic `click` event. Even when `pointerup` selected a node, the subsequent `click` event bubbled up to the canvas container, which had an unconditional `onBackgroundClick` handler that cleared selection.
    - `stopPropagation()` on `pointerdown` was insufficient because it did not prevent the later `click` event from firing.
4. **Interaction Gating:** The pan handler did not check if the interaction started on a node, leading to "Monopoly" failures where two distinct gestures (drag and pan) were active simultaneously.

## Lessons Learned
1. **Gesture Monopoly:** A single gesture (pointer down → move → up) MUST have exactly one owner. If a node is being dragged, the background pan MUST be suppressed.
2. **Event Truth:** Do not assume `pointerup` is the end of the interaction. The browser will fire a `click` event after `pointerup` if the pointer hasn't moved significantly. Global or container-level "click to deselect" handlers must be guarded with `e.target` inspection.
3. **Screen vs World Separation:** Patterns intended to orient the user (like grid dots) belong in Screen Space (CSS). Nodes and edges belong in World Space (SVG transforms). Mixing them leads to "CAD fidelity" loss.
4. **Semantic Token Purity:** Hardcoded colors (bg-black, #000) are brittle. Dark theme depth requires strict adherence to the 3-layer depth model (VOID, SURFACE, ELEVATION).

## DO NOT REPEAT
- **NO** SVG `<pattern>` for grid dots. Use CSS `radial-gradient` on the container.
- **NO** unconditional `onClick` handlers on the canvas container. Always check `e.target.closest('[data-testid="canvas-node"]')`.
- **NO** manual coordinate math for panning if a node drag is active.
- **NO** assumptions that `stopPropagation()` on pointer events stops the browser `click` event.
