# Struxient Workflow Builder — UX Law v1.1

This document defines the non-negotiable UX laws for the Struxient Workflow Builder. Compliance is mandatory for all PRs affecting the workflow builder surface.

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

---
*Failure to comply with these laws results in an immediate PR rejection.*
