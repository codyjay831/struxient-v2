# Changelog

All notable changes to the Struxient project will be documented in this file.

## [2026-02-02]

### Added
- **Individual Node Dragging**: Users can now drag nodes independently in the FlowSpec Builder canvas. This enables custom spatial organization without affecting underlying FlowSpec topology truth.

### Fixed
- **Canvas Interaction Fidelity**: 
    - Resolved "flicker" bug where node inspector would close immediately after opening due to event bubbling.
    - Implemented **Gesture Monopoly** to prevent canvas panning while dragging nodes.
    - Switched from SVG-based to CSS-based grid dots (`radial-gradient`) to ensure dots remain crisp and screen-space during zoom.
- **Dark Theme Depth Alignment**:
    - Aligned FlowSpec Builder and core layouts to the 3-layer depth model (VOID, SURFACE, ELEVATION) using semantic tokens.
    - Eliminated hardcoded black backgrounds in full-bleed routes to ensure proper token adoption.
