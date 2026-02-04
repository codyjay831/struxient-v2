# FlowSpec Builder Contract

**Document ID:** 40_flowspec_builder_contract  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Related Documents:**
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [41_flowspec_structured_builder_ux.md](./41_flowspec_structured_builder_ux.md)
- [42_flowspec_builder_screen_api_matrix.md](./42_flowspec_builder_screen_api_matrix.md)
- [50_flowspec_builder_ui_api_map.md](./50_flowspec_builder_ui_api_map.md)

---

## 1. Purpose

This document defines the behavioral contract for the FlowSpec Builder. The Builder is a first-class product surface for creating, editing, and managing Workflow specifications.

**Rule:** All Builder implementations MUST conform to this contract.

---

## 1.1 Implementation Phases

The Builder contract supports two valid implementation approaches that may be delivered in phases:

| Phase | Implementation | Document | Description |
|-------|---------------|----------|-------------|
| **Phase 1** | Structured Builder | [41_flowspec_structured_builder_ux.md](./41_flowspec_structured_builder_ux.md) | Lists + panels interface. Full API coverage. No canvas. |
| **Phase 2** | Visual Graph Builder | This document (§3, §5.5) | Canvas-based drag-and-drop graph editing. |

**Phasing Rules:**
1. Phase 1 (Structured Builder) is a VALID, COMPLETE implementation that satisfies all functional requirements.
2. Phase 2 (Visual Graph) is an ENHANCEMENT, not a prerequisite.
3. Both phases MUST enforce all invariants identically.
4. Phase 1 MUST expose 100% of FlowSpec capabilities through structured UI.
5. Phase 2 requirements (§3, §5.5) are DEFERRED, not removed.

**Explicit Deferral (Phase 2):**
- §3 (Visual Graph Editing) — DEFERRED to Phase 2
- §5.1 (Drag and Move on canvas) — DEFERRED to Phase 2
- §5.5 (Canvas Interaction Contract) — DEFERRED to Phase 2
- §9.1.1 (Graph Readability Requirements) — DEFERRED to Phase 2
- §11.1 (Visual Graph Acceptance) — DEFERRED to Phase 2

**Phase 1 Deliverables:**
- Workflow List view
- Node management via structured panels
- Task/Outcome editing via forms
- Gate routing via table-based editor
- Validation results display
- Publish/Version management

See [41_flowspec_structured_builder_ux.md](./41_flowspec_structured_builder_ux.md) for Phase 1 canonical specification.

---

## 2. Builder Goals

### 2.1 Primary Goals

| # | Goal | Description |
|---|------|-------------|
| G1 | Ease of Understanding | Users can understand Workflow structure at a glance. |
| G2 | Completeness | Every FlowSpec capability is accessible through the Builder. |
| G3 | Discoverability | Users can find features without documentation. |
| G4 | Predictability | User actions have consistent, expected results. |
| G5 | Error Prevention | The Builder prevents illegal states before they occur. |

### 2.2 Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| NG1 | Replace API access | The Builder complements but does not replace API. |
| NG2 | Hide advanced features | Power users must have full access. |
| NG3 | Enforce workflow patterns | The Builder is unopinionated about workflow design. |

---

## 3. Core Principle: Visual Graph Editing

### 3.1 Graph-First Design

**Rule:** The Builder MUST present Workflows as visual graphs.

**Requirements:**
1. Nodes are displayed as discrete visual elements.
2. Gates are displayed as connections (edges/arrows) between Nodes.
3. The graph layout reflects the actual execution topology.
4. Users can answer "If outcome X happens, where do we go?" by visual inspection.

### 3.2 Visual Elements

| Element | Represents | Visual Treatment |
|---------|------------|------------------|
| Node | Node (container for Tasks) | Rectangular or card-like shape |
| Edge/Arrow | Gate routing | Directed line/arrow with Outcome label |
| Entry Indicator | Entry Node(s) | Distinct marker (icon/badge/border) |
| Terminal Indicator | Terminal paths | Distinct marker or absence of outbound edges |
| Validation Error | Invalid state | Visual highlight (color/icon/badge) |

---

## 4. Allowed Editing Operations

### 4.1 Node Operations

| Operation | Description | Validation |
|-----------|-------------|------------|
| Create Node | Add a new Node to the Workflow | Node name required, must be unique |
| Delete Node | Remove a Node from the Workflow | Warn if Node has connections; cascade delete Tasks |
| Rename Node | Change Node display name | Name must be unique |
| Move Node | Change Node position in canvas | Visual only; does not affect execution |
| Edit Completion Rule | Set Node completion rule (ALL_TASKS_DONE, etc.) | Must be valid rule type |
| Mark as Entry | Designate Node as Entry Node | At least one Entry required |

### 4.2 Task Operations

| Operation | Description | Validation |
|-----------|-------------|------------|
| Create Task | Add a new Task to a Node | Task name required, must be unique within Node |
| Delete Task | Remove a Task from a Node | Warn if Task has Outcome routes |
| Rename Task | Change Task display name | Name must be unique within Node |
| Reorder Tasks | Change Task order within Node | Visual only; does not affect execution |
| Define Outcomes | Set allowed Outcomes for Task | At least one Outcome required |
| Set Evidence Requirements | Configure Evidence requirements | Schema must be valid |

### 4.3 Outcome Operations

| Operation | Description | Validation |
|-----------|-------------|------------|
| Add Outcome | Add new Outcome to Task | Name required, must be unique within Task |
| Remove Outcome | Remove Outcome from Task | Must remove associated Gate route first |
| Rename Outcome | Change Outcome name | Name must be unique within Task |

### 4.4 Gate Operations

| Operation | Description | Validation |
|-----------|-------------|------------|
| Create Route | Connect Outcome to target Node | Target Node must exist |
| Delete Route | Remove routing for an Outcome | Creates orphan warning |
| Change Target | Update route target Node | Target Node must exist |

---

## 5. UX Rules

### 5.1 Drag and Move

**Requirements:**
1. Nodes MUST be draggable within the canvas.
2. Edges (arrows/strings) MUST follow dynamically when Nodes move.
3. Drag-and-drop for creating connections is OPTIONAL, not required.
4. Manual routing via menus/forms MUST always be available.

### 5.2 Visibility and Clarity

**Requirements:**
1. All Nodes MUST be visible (no hidden Nodes).
2. All Gates/routes MUST be visible (no hidden edges).
3. Entry Nodes MUST be visually distinguished.
4. Terminal paths MUST be visually distinguished.
5. Validation errors MUST be visually highlighted.
6. Users MUST be able to zoom and pan the canvas.

### 5.3 Selection and Context

**Requirements:**
1. Clicking a Node selects it and shows its details (Tasks, Outcomes).
2. Clicking an Edge selects it and shows its routing rule.
3. Multi-select is OPTIONAL.
4. Context menus or panels MUST provide access to all operations.

### 5.4 Undo/Redo

**Requirements:**
1. The Builder SHOULD support undo/redo for editing operations.
2. Undo stack applies to Draft Workflows only.
3. Publishing is NOT undoable (creates new version instead).

---

## 5.5 Builder Canvas Interaction Contract (Non-Executable)

This section defines canvas interaction semantics. These interactions are purely visual and MUST NOT affect execution logic.

### 5.5.1 Canvas Pan

**Requirements:**
1. Users MUST be able to pan the canvas by dragging any empty space.
2. Pan position MUST NOT affect Workflow semantics.
3. Pan position MAY be persisted as user preference (not Workflow data).

### 5.5.2 Node Drag

**Requirements:**
1. Nodes MUST be draggable to arbitrary positions on the canvas.
2. Node position MUST NOT imply execution order, readiness, or priority.
3. Node position MUST NOT affect Gate routing or Actionability.
4. Two Nodes at the same Y-coordinate MUST NOT imply parallelism.
5. A Node positioned "before" another MUST NOT imply it executes first.

### 5.5.3 Edge/Arrow Behavior

**Requirements:**
1. Edges MUST visually follow their connected Nodes during drag in real time.
2. Edge routing (path, curves, anchor points) MUST NOT encode execution semantics.
3. Edge visual style (straight, curved, orthogonal) is presentation only.
4. Overlapping edges MUST NOT imply relationship or priority.

### 5.5.4 Zoom

**Requirements:**
1. Zoom MUST be supported via mouse wheel and/or trackpad gestures.
2. Zoom level MUST NOT affect Workflow behavior or validation.
3. Zoom level MAY be persisted as user preference.
4. All elements MUST remain interactive at all supported zoom levels.

### 5.5.5 Selection Model

**Requirements:**
1. Single-select MUST be supported (click Node or Edge).
2. Multi-select SHOULD be supported (Shift+click or drag-select).
3. Selection MUST be visual only — it MUST NOT affect Workflow data.
4. Selection MUST NOT imply grouping, relationship, or batch operations on execution.

### 5.5.6 Keyboard Interaction

**Requirements:**
1. Delete key MAY delete selected element(s) (with validation).
2. Escape key MAY deselect or cancel current operation.
3. Arrow keys MAY nudge selected Node(s) by small increments.
4. Keyboard actions MUST NOT bypass validation rules.
5. Keyboard shortcuts MUST NOT create invalid Workflow states silently.

### 5.5.7 Explicit Prohibition: Spatial Layout Semantics

> **⚠️ Critical Boundary:**
> Spatial layout (position, ordering, proximity, alignment) MUST NOT imply or encode:
> - Execution sequence
> - Lifecycle or progress
> - Priority or importance
> - Temporal ordering
> - Readiness or Actionability
>
> The graph topology (Nodes, Gates, routing) defines execution. Canvas layout is visualization only.

**Violation Examples:**
- Nodes arranged left-to-right execute in that order → WRONG
- Nodes at the top are "earlier" in the workflow → WRONG
- Vertically aligned Nodes execute in parallel → WRONG
- Node proximity implies relationship → WRONG

**Correct Understanding:**
- Execution order is determined by Gates and Outcomes only.
- Canvas layout helps humans understand; it does not instruct the engine.

### 5.5.8 Persisted Spatial Layout (Draft Only)

**Invariant — Persisted Spatial Layout (Draft Only)**
Node spatial positions are persisted as design-time metadata for Draft workflows. Manual layout changes MUST survive reloads and sessions. Spatial layout MUST NOT affect execution semantics and MUST NOT be mutated for Published or Validated workflows.

**The "Why"**
The FlowSpec Builder is an Orienting Surface. Manual spatial arrangement is a deliberate act of design that encodes how a human should read the workflow topology. Persistence ensures this "mental map" remains stable, preventing disorientation and accidental layout loss across sessions.

**Implementation Anchors:**
- `src/components/canvas/workflow-canvas.tsx` (Coordinates preference logic)
- `src/app/(app)/(fullbleed)/flowspec/[workflowId]/page.tsx` (Drag-end persistence gate)
- `Node.position` schema field (Authoritative storage)

### 5.5.9 Loopback Edge Directionality & Perimeter Anchoring

**Invariant — Loopback Arrowheads**
Loopback edges (blue dashed) MUST render with visible arrowheads to indicate directionality. This is a requirement for the Builder's role as an Orienting Surface. Forward-flowing edges remain arrowless to reduce visual noise.

**Invariant — Perimeter Anchoring**
Loopback edge path endpoints MUST NOT be fixed to node centers or a single side. Endpoints MUST be computed as the intersection point of the edge path with the node's rectangular perimeter. This ensures the edge enters/leaves the node at a natural angle regardless of relative node positions.

**Invariant — Visibility Padding**
Target endpoints for loopback edges MUST be padded outward from the node perimeter (recommended: 6px). This ensures the SVG arrowhead marker is fully visible and not clipped or hidden under the node's visual rectangle.

**Implementation Anchors:**
- `src/lib/canvas/layout.ts` (`getPerimeterPoint` utility)
- `src/components/canvas/workflow-canvas.tsx` (`renderEdge` loopback branch using `getPerimeterPoint` + padding)
- `src/components/canvas/workflow-canvas.tsx` (`<marker id="arrowhead-special">` definitions)

---

## 5.6 Structured Builder Interaction Contract (Phase 1)

This section defines interaction semantics for the Structured Builder (Phase 1). These rules apply when canvas-based editing is not yet implemented.

### 5.6.1 List-Based Display

**Requirements:**
1. Nodes are displayed as items in a list or card grid, NOT on a spatial canvas.
2. List order MAY be alphabetical, creation order, or user-defined display order.
3. List order MUST NOT imply execution sequence or priority.
4. Visual hierarchy (indentation, grouping) MUST NOT encode execution semantics.

### 5.6.2 Drag in Structured Mode

**Definition:** In Structured Builder, "drag" means REORDER within a list, NOT spatial positioning.

**Requirements:**
1. Dragging a Node in the Node list changes its display order only.
2. Dragging a Task in the Task list changes its `displayOrder` only.
3. Drag-reorder MUST NOT affect Gate routing or execution order.
4. Drag-reorder MAY be persisted for user convenience (purely visual preference).

**Explicit Prohibition:**
> Dragging to reorder MUST NOT be interpreted as changing workflow execution.
> Execution order is determined by Gates and Outcomes only.

### 5.6.3 Selection in Structured Mode

**Requirements:**
1. Clicking a Node in the list opens its detail panel (Tasks, Completion Rule).
2. Clicking a Task in the list opens its detail panel (Outcomes, Evidence, Dependencies).
3. Selection MUST be visual only — it MUST NOT affect Workflow data.
4. Only one entity may be selected at a time (no multi-select required in Phase 1).

### 5.6.4 Routing in Structured Mode

**Requirements:**
1. Gate routing is managed via a table-based Routing Editor, NOT visual edge drawing.
2. The Routing Editor lists all Outcomes and their target Nodes.
3. Users select target Nodes from a dropdown/autocomplete.
4. `null` target (terminal) is an explicit option labeled "Terminal" or "(End Flow)".
5. Orphaned Outcomes (no route) are highlighted as validation errors.

### 5.6.5 Invariant Preservation

> **⚠️ Critical Boundary:**
> All invariants (INV-001 through INV-024) apply equally to Structured Builder.
> The absence of a canvas does NOT relax any invariant.

Specifically:
- INV-012 (Graph-First Execution) — List order does NOT determine execution.
- INV-004 (No Stage-Implied Readiness) — Display order does NOT imply readiness.
- INV-003 (Gates Route Only) — Routing is explicit via Routing Editor.
- INV-008 (All Outcomes Routed) — Routing Editor enforces this visually.

---

## 6. Error States and Recovery

### 6.1 Validation Errors

| Error Type | Detection | Display | Recovery |
|------------|-----------|---------|----------|
| Orphaned Outcome | Outcome has no Gate route | Highlight on Task/Outcome | Create route or remove Outcome |
| Unreachable Node | Node cannot be reached from Entry | Highlight on Node | Create route to Node or delete |
| No Entry Node | No Node marked as Entry | Global error banner | Mark a Node as Entry |
| Missing Outcomes | Task has zero Outcomes | Highlight on Task | Add Outcome |
| Invalid Gate Target | Route points to non-existent Node | Highlight on Edge | Fix target or delete route |
| Duplicate Names | Two Nodes/Tasks have same name | Highlight on duplicates | Rename one |

### 6.2 Error Display Rules

**Requirements:**
1. Errors MUST be surfaced immediately (as user edits).
2. Errors MUST NOT block editing (user can continue working).
3. Errors MUST prevent Validation action (Draft → Validated).
4. Errors MUST have actionable descriptions.
5. Clicking an error SHOULD navigate to the affected element.

### 6.3 Guardrails

**Requirements:**
1. The Builder MUST prevent creation of obviously illegal states where possible:
   - Cannot delete last Entry Node without designating another
   - Cannot delete Outcome without deleting its route first (or cascading)
2. The Builder SHOULD warn before destructive operations.
3. The Builder MUST NOT silently discard user work.

---

## 7. Validation Behavior

### 7.1 Validation Trigger

**Options:**
1. Manual: User clicks "Validate" button
2. Auto: Validation runs on every change (with debouncing)

**Requirement:** At minimum, validation MUST run before Publish action.

### 7.2 Validation Scope

Validation checks (see [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md) Section 8):
- Structural validation
- Outcome/Gate validation
- Evidence validation
- Semantic validation

### 7.3 Validation Output

**Requirements:**
1. Return list of all errors (not just first error).
2. Each error includes: severity, location, description, suggested fix.
3. Errors are categorized (structural, semantic, etc.).
4. Zero errors = Validation passes.

---

## 8. Versioning Rules (Conceptual)

### 8.1 Draft Behavior

**Rules:**
1. Drafts are freely editable.
2. Multiple drafts may exist for the same Workflow.
3. Drafts are not executable.
4. Drafts may be discarded without affecting Published versions.
5. Drafts MAY be incomplete to support incremental authoring (e.g., INV-025 Evidence Schema is not enforced for Drafts).

### 8.2 Publish Behavior

**Rules:**
1. Publishing creates a new immutable version.
2. Publishing requires passing validation (Zero findings). INV-025 is enforced at the VALIDATED transition and at Publish time.
3. Published versions are numbered/identified uniquely.
4. Publishing does NOT modify or delete previous versions.

### 8.3 Version Viewing

**Requirements:**
1. Users can view any Published version (read-only).
2. Users can compare versions (diff view is OPTIONAL).
3. Users can create a new Draft from a Published version (branching).

---

## 9. Non-Functional Requirements

### 9.1 Theme Support

**Requirement:** The Builder MUST support both Light Mode and Dark Mode.

**Specific Requirements:**
1. Graph canvas MUST be legible in both themes.
2. Edges/arrows MUST be visible in both themes.
3. Validation error indicators MUST be visible in both themes.
4. All controls and panels MUST be legible in both themes.
5. Theme switching MUST NOT require page reload.

### 9.1.1 Graph Readability Requirements (Testable)

**Contrast Requirements:**
1. Node backgrounds MUST have sufficient contrast against canvas background to be distinguishable.
2. Node borders/outlines MUST be visible in both themes.
3. Edge/arrow strokes MUST be visible against canvas and over Node backgrounds.
4. Text (Node names, Outcome labels) MUST meet WCAG AA contrast ratio (4.5:1 minimum).

**State Distinction Requirements:**
1. Selected state MUST be visually distinct from unselected (not color alone).
2. Error/invalid state MUST be visually distinct from valid (not color alone).
3. Entry Node indicator MUST be visible in both themes.
4. Terminal path indicator MUST be visible in both themes.
5. Hover state MUST be distinguishable from resting state.

**⚠️ Critical Boundary — Theme Semantics:**
> Theme MUST NOT encode execution semantics. Specifically:
> - Color MUST NOT indicate status, progress, or lifecycle state.
> - Light/Dark mode MUST NOT change which elements are visible.
> - Theme MUST NOT affect validation or Workflow data.
>
> Theme is presentation preference only.

### 9.2 Performance

**Requirements:**
1. Canvas must remain responsive with 100+ Nodes.
2. Drag/move operations must not lag visibly.
3. Validation must complete within 2 seconds for typical Workflows.

### 9.3 Accessibility

**Requirements:**
1. All operations must be keyboard-accessible.
2. ARIA labels must be provided for screen readers.
3. Color must not be the only indicator of state (use icons/shapes too).

### 9.4 Browser Support

**Requirement:** Support latest versions of Chrome, Firefox, Safari, Edge.

---

## 10. Feature Reachability

### 10.1 UI + API Parity

**Rule:** Every feature accessible in the UI MUST also be accessible via API, and vice versa.

| Feature | UI Access | API Access |
|---------|-----------|------------|
| Create Workflow | ✓ | ✓ |
| Create/Edit/Delete Node | ✓ | ✓ |
| Create/Edit/Delete Task | ✓ | ✓ |
| Define Outcomes | ✓ | ✓ |
| Create/Edit/Delete Gate | ✓ | ✓ |
| Set Evidence Requirements | ✓ | ✓ |
| Validate | ✓ | ✓ |
| Publish | ✓ | ✓ |
| View Version | ✓ | ✓ |
| List Versions | ✓ | ✓ |

### 10.2 No Hidden Features

**Rule:** The Builder MUST NOT hide power features or advanced options. All capabilities must be discoverable through the UI.

---

## 11. Acceptance Checklist

The following statements must be true for the Builder to be considered complete.

**Note:** Phase 1 (Structured Builder) and Phase 2 (Visual Graph) have separate acceptance criteria. Phase 1 is COMPLETE when §11.1A + §11.2-11.6 pass. Phase 2 is COMPLETE when §11.1B is additionally satisfied.

### 11.1A Structured Builder (Phase 1)

- [ ] Workflows display as a list/grid with name, status, and last updated.
- [ ] Clicking a Workflow opens its detail view with Node list.
- [ ] Nodes display as a list with name, Entry indicator, and Task count.
- [ ] Clicking a Node opens its detail panel with Tasks.
- [ ] Routing Editor shows all Outcomes and their target Nodes in table format.
- [ ] Entry Nodes are visually marked (badge/icon in list).
- [ ] Terminal routes are explicitly shown as "(Terminal)" in Routing Editor.
- [ ] Validation errors display in a dedicated panel with clickable navigation.

### 11.1B Visual Graph (Phase 2 — DEFERRED)

- [ ] Workflows display as visual node graphs.
- [ ] Edges show Outcome-based routing.
- [ ] Nodes can be dragged and repositioned.
- [ ] Edges follow Nodes dynamically during drag.
- [ ] Entry Nodes are visually distinct on canvas.
- [ ] Terminal paths are visually distinct on canvas.

### 11.2 Editing

- [ ] Users can create, edit, delete Nodes (Draft only).
- [ ] Users can create, edit, delete Tasks (Draft only).
- [ ] Users can define and remove Outcomes (Draft only).
- [ ] Users can create and modify Gate routes (Draft only).
- [ ] Users can set Evidence requirements (Draft only).
- [ ] Users can mark/unmark Entry Nodes (Draft only).
- [ ] Users can set Node completion rules (Draft only).

### 11.3 Validation

- [ ] Validation runs before Publish.
- [ ] All validation errors are displayed.
- [ ] Errors include location and description.
- [ ] Clicking errors navigates to affected element.
- [ ] Zero errors allows Publish.

### 11.4 Guardrails

- [ ] Orphaned Outcomes are flagged.
- [ ] Unreachable Nodes are flagged.
- [ ] Missing Entry Node is flagged.
- [ ] Destructive operations have confirmations.

### 11.5 Versioning & Templates

- [ ] Drafts can be saved and edited.
- [ ] Validation transitions Draft to Validated.
- [ ] Validated ↔ Draft (Revert to Draft path for editing).
- [ ] Publish transitions Validated to Published.
- [ ] Published versions are immutable.
- [ ] Users can view previous versions.
- [ ] Users can list available templates in the Library.
- [ ] Users can import a template into a new Draft workflow.

### 11.6 Non-Functional

- [ ] Light Mode works correctly.
- [ ] Dark Mode works correctly.
- [ ] Theme switch is seamless.
- [ ] Performance is acceptable at 100+ Nodes.
- [ ] All features are keyboard-accessible.

---

## 12. Template Library Integration

### 12.1 Library View
1. The Builder MUST provide a view of the **Snapshot Library** (available `WorkflowTemplate` records).
2. Templates MUST be displayed with name, version, tradeKey, category, and tags.

### 12.2 Import Action
1. Importing a template MUST create a new Workflow in **Draft** state.
2. The import process MUST regenerate all internal IDs to ensure uniqueness within the tenant workspace.
3. Provenance fields (`templateId`, `templateVersion`) MUST be populated at import and locked (INV-028).

---

**End of Document**
