# FlowSpec Structured Builder UX Specification

**Document ID:** 41_flowspec_structured_builder_ux  
**Status:** CANONICAL  
**Last Updated:** 2026-01-28  
**Phase:** Phase 1 (Structured Builder)  
**Related Documents:**
- [40_flowspec_builder_contract.md](./40_flowspec_builder_contract.md) — Parent contract
- [42_flowspec_builder_screen_api_matrix.md](./42_flowspec_builder_screen_api_matrix.md) — API wiring
- [50_flowspec_builder_ui_api_map.md](./50_flowspec_builder_ui_api_map.md) — Full API reference
- [20_flowspec_invariants.md](./20_flowspec_invariants.md) — Invariants

---

## 1. Purpose

This document canonically defines the Structured Builder (Phase 1) user experience. The Structured Builder provides full FlowSpec authoring capabilities through lists, panels, and forms — without requiring a canvas or graph editor.

**This document is AUTHORITATIVE for Phase 1 implementation.**

---

## 2. Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| NG1 | Canvas/graph visualization | Deferred to Phase 2 |
| NG2 | Drag-to-connect edges | Deferred to Phase 2 |
| NG3 | Spatial positioning of Nodes | Deferred to Phase 2 |
| NG4 | Work Station runtime UI | Out of scope (separate epic) |
| NG5 | Execution monitoring | Out of scope (runtime concern) |
| NG6 | Permissions/RBAC configuration | Out of scope |

---

## 3. Target Users

| User Type | Description | Primary Tasks |
|-----------|-------------|---------------|
| **Operations Admin** | Designs and publishes workflows | Create workflows, define routing, validate, publish |
| **Contractor** | Reviews workflow structure | View workflows, understand routing |
| **Developer** | Integrates with FlowSpec API | Verify API alignment, test workflows |

**Mental Model:** Users think in terms of:
- "What are the steps (Nodes)?"
- "What work happens at each step (Tasks)?"
- "What can happen when work is done (Outcomes)?"
- "Where do we go next (Routing/Gates)?"

---

## 4. Core Mental Model: Lists + Panels

The Structured Builder presents workflow structure as nested lists with detail panels:

```
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW LIST                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Sales Workflow (Draft)           [Validate] [Publish]       │ │
│ │ Finance Workflow (Published v3)  [View] [New Draft]         │ │
│ │ Execution Workflow (Validated)   [Publish]                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (click workflow)
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW DETAIL: Sales Workflow (Draft)                         │
│ ┌───────────────────────┬───────────────────────────────────────┤
│ │ NODE LIST             │ NODE DETAIL PANEL                     │
│ │                       │                                       │
│ │ ► Qualify Lead [E]    │ Node: Close Deal                      │
│ │   Present Proposal    │ Entry: No                             │
│ │ ► Close Deal          │ Completion: ALL_TASKS_DONE            │
│ │                       │                                       │
│ │ [+ Add Node]          │ TASKS:                                │
│ │                       │ ┌─────────────────────────────────┐   │
│ │                       │ │ Collect Signature               │   │
│ │                       │ │   Outcomes: SIGNED, DECLINED    │   │
│ │                       │ └─────────────────────────────────┘   │
│ │                       │ [+ Add Task]                          │
│ └───────────────────────┴───────────────────────────────────────┤
│ ROUTING EDITOR (table)                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Source Node   │ Outcome  │ Target Node      │ Status        │ │
│ ├───────────────┼──────────┼──────────────────┼───────────────┤ │
│ │ Qualify Lead  │ QUALIFIED│ Present Proposal │ ✓             │ │
│ │ Close Deal    │ SIGNED   │ (Terminal)       │ ✓             │ │
│ │ Close Deal    │ DECLINED │ (Terminal)       │ ✓             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ VALIDATION RESULTS                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✓ All checks passed                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Screen Specifications

### 5.1 Workflow List Screen

**URL:** `/flowspec`

**Purpose:** Display all Workflows for the current tenant. Entry point to the Builder.

#### 5.1.1 What the User Sees

| Element | Description |
|---------|-------------|
| Page Header | "FlowSpec Builder" title with description |
| Workflow Table/Grid | List of all workflows with columns: Name, Status, Version, Last Updated |
| Status Badges | DRAFT (yellow), VALIDATED (blue), PUBLISHED (green) |
| Action Buttons | Per-row actions based on status |
| "New Workflow" Button | Primary action to create a new workflow |
| Empty State | Message when no workflows exist |

#### 5.1.2 What the User Can Do

| Action | Trigger | Result |
|--------|---------|--------|
| Create Workflow | Click "New Workflow" → modal → enter name | New Draft created, navigate to detail |
| Open Workflow | Click workflow row | Navigate to Workflow Detail |
| Delete Workflow | Click delete icon (Draft only) | Confirmation → delete |
| Search/Filter | Type in search box | Filter list by name |

#### 5.1.3 What the User Cannot Do

| Blocked Action | Reason | Safety Rule |
|----------------|--------|-------------|
| Edit Published Workflow directly | INV-011 | Button disabled; tooltip explains |
| Delete Published Workflow | Data integrity | Button hidden or disabled |

#### 5.1.4 Closes Gaps

- **GAP-002** (No Workflow List View) — CLOSED

---

### 5.2 Workflow Detail Screen

**URL:** `/flowspec/workflows/[id]`

**Purpose:** View and edit a single Workflow's structure (Nodes, Tasks, Routing).

#### 5.2.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: Workflow Name (editable) + Status Badge                 │
│ [Validate] [Publish] [Versions ▼] [Delete]                      │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬─────────────────────────────────────────┤
│ │ NODE LIST (left)    │ DETAIL PANEL (right)                    │
│ │ 250-300px wide      │ Remaining width                         │
│ │                     │                                         │
│ │ [+ Add Node]        │ (Shows selected Node or empty state)    │
│ └─────────────────────┴─────────────────────────────────────────┤
│ ROUTING EDITOR (collapsible section, bottom)                    │
├─────────────────────────────────────────────────────────────────┤
│ VALIDATION PANEL (collapsible section, bottom)                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2.2 Node List Panel

**What the User Sees:**

| Element | Description |
|---------|-------------|
| Node Items | Each Node as a row/card with name |
| Entry Indicator | Badge/icon [E] on Entry Nodes |
| Task Count | "(3 tasks)" indicator |
| Selection State | Highlighted row when selected |
| Add Node Button | At bottom of list |

**What the User Can Do:**

| Action | Trigger | Result |
|--------|---------|--------|
| Select Node | Click row | Shows Node Detail Panel |
| Add Node | Click "+ Add Node" | Modal → enter name → create |
| Reorder Nodes | Drag handle | Changes display order (visual only) |
| Delete Node | Context menu or icon | Confirmation → cascade delete tasks |
| Mark as Entry | In detail panel | Node gains [E] badge |

**What the User Cannot Do:**

| Blocked Action | Reason | Safety Rule |
|----------------|--------|-------------|
| Delete last Entry Node | INV-014 | Error: "At least one Entry Node required" |
| Edit if Published | INV-011 | All edit controls disabled |

#### 5.2.3 Node Detail Panel

**What the User Sees:**

| Element | Description |
|---------|-------------|
| Node Name | Editable text field |
| Entry Toggle | Checkbox "Mark as Entry Node" |
| Completion Rule | Dropdown: ALL_TASKS_DONE, ANY_TASK_DONE, SPECIFIC_TASKS_DONE |
| Specific Tasks | Multi-select (visible only if SPECIFIC_TASKS_DONE) |
| Task List | Nested list of Tasks in this Node |
| Add Task Button | Creates new Task in this Node |

**What the User Can Do:**

| Action | Trigger | Result |
|--------|---------|--------|
| Rename Node | Edit name field, blur/enter | PATCH node |
| Toggle Entry | Click checkbox | PATCH node.isEntry |
| Change Completion Rule | Select from dropdown | PATCH node.completionRule |
| Add Task | Click "+ Add Task" | Modal → create task |
| Select Task | Click task row | Shows Task Detail Panel |
| Reorder Tasks | Drag handle | PATCH tasks/reorder |
| Delete Task | Context menu | Confirmation → delete |

#### 5.2.4 Closes Gaps

- **GAP-003** (No Node Selection / Side Panel) — CLOSED
- **GAP-007** (No Entry/Terminal Indicators) — CLOSED (Entry badge visible)

---

### 5.3 Task Detail Panel

**Displayed:** When a Task is selected within Node Detail

#### 5.3.1 What the User Sees

| Element | Description |
|---------|-------------|
| Task Name | Editable text field |
| Instructions | Multiline text area |
| Evidence Required | Toggle checkbox |
| Evidence Schema | JSON editor (visible if evidence required) |
| Outcomes Section | List of Outcomes with add/delete |
| Cross-Flow Dependencies | List with add/remove capability |

#### 5.3.2 Outcomes Editor

| Element | Description |
|---------|-------------|
| Outcome List | Each outcome as a chip/tag |
| Add Outcome | Button → inline input or modal |
| Delete Outcome | X button on chip |
| Validation Warning | Highlight if outcome has no route |

**What the User Can Do:**

| Action | Trigger | Result |
|--------|---------|--------|
| Add Outcome | Click "+ Add Outcome" | Inline add or modal |
| Delete Outcome | Click X on outcome | DELETE outcome (warns if routed) |
| Rename Outcome | Click to edit inline | PATCH outcome |

#### 5.3.3 Cross-Flow Dependencies Editor

| Element | Description |
|---------|-------------|
| Dependency List | Table: Source Workflow, Task Path, Required Outcome |
| Add Dependency | Button → modal with workflow/task/outcome selectors |
| Delete Dependency | Delete icon per row |

**What the User Can Do:**

| Action | Trigger | Result |
|--------|---------|--------|
| Add Dependency | Click "+ Add" → modal | POST cross-flow-dependency |
| Delete Dependency | Click delete icon | DELETE dependency |

#### 5.3.4 Evidence Schema Editor

| Element | Description |
|---------|-------------|
| Enable Toggle | "Require Evidence" checkbox |
| Schema Editor | JSON editor for schema definition |
| Validation | Real-time JSON syntax check |

---

### 5.4 Routing Editor Screen

**Location:** Collapsible section in Workflow Detail, or dedicated tab

**Purpose:** Define Gate routing (Outcome → Target Node) in a structured table format.

#### 5.4.1 What the User Sees

| Column | Description |
|--------|-------------|
| Source Node | Node name (read-only, grouped) |
| Outcome | Outcome name from Tasks in that Node |
| Target Node | Dropdown: select target or "(Terminal)" |
| Status | ✓ if valid, ⚠ if orphaned |

**Example Table:**

| Source Node | Outcome | Target Node | Status |
|-------------|---------|-------------|--------|
| Qualify Lead | QUALIFIED | Present Proposal | ✓ |
| Qualify Lead | DISQUALIFIED | (Terminal) | ✓ |
| Present Proposal | ACCEPTED | Close Deal | ✓ |
| Present Proposal | REJECTED | ⚠ Not set | ⚠ |
| Close Deal | SIGNED | (Terminal) | ✓ |
| Close Deal | DECLINED | (Terminal) | ✓ |

#### 5.4.2 What the User Can Do

| Action | Trigger | Result |
|--------|---------|--------|
| Set Target | Select from dropdown | POST/PATCH gate |
| Clear Route | Select "(None)" | DELETE gate (creates orphan warning) |
| Set Terminal | Select "(Terminal)" | POST gate with targetNodeId: null |

#### 5.4.3 What the User Cannot Do

| Blocked Action | Reason | Safety Rule |
|----------------|--------|-------------|
| Create route to non-existent Node | Validation | Dropdown only shows existing Nodes |
| Leave orphaned Outcomes | Validation warning | ⚠ icon, blocks Publish |

#### 5.4.4 Closes Gaps

- **GAP-005** (No Gate/Edge Visual Rendering) — PARTIALLY CLOSED (table-based, not visual edges)
  - Note: Visual edges deferred to Phase 2. Table-based routing provides equivalent functionality.

---

### 5.5 Validation Results Panel

**Location:** Collapsible section in Workflow Detail

**Purpose:** Display validation errors and warnings with navigation.

#### 5.5.1 What the User Sees

| Element | Description |
|---------|-------------|
| Summary | "X errors, Y warnings" or "All checks passed ✓" |
| Error List | Grouped by category (structural, routing, evidence, semantic) |
| Error Item | Severity icon, message, affected element path |
| Navigation | Clicking error navigates to affected element |

**Example:**

```
VALIDATION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ 2 errors found — Cannot publish until resolved

STRUCTURAL (1)
  ✖ NO_ENTRY_NODE: No Node is marked as entry point
    → Click to fix: Mark a Node as Entry

ROUTING (1)
  ✖ ORPHANED_OUTCOME: Outcome "REJECTED" in Task "Review Document" has no route
    → Click to fix: Node "Review" → Task "Review Document"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 5.5.2 What the User Can Do

| Action | Trigger | Result |
|--------|---------|--------|
| Run Validation | Click "Validate" button | POST validate → display results |
| Navigate to Error | Click error item | Scrolls/selects affected element |
| Dismiss Panel | Click collapse | Hides panel (errors persist) |

#### 5.5.3 Closes Gaps

- **GAP-004** (No Validation Error Display) — CLOSED

---

### 5.6 Publish & Versions Panel

**Location:** Header actions + modal/dropdown

#### 5.6.1 Publish Flow

1. User clicks "Publish" button
2. System runs validation automatically
3. If errors: Show validation panel, block publish
4. If valid: Confirmation modal → "Publish as version X?"
5. On confirm: POST publish → Success toast → Status changes to PUBLISHED

#### 5.6.2 Version Dropdown

| Element | Description |
|---------|-------------|
| Current Version | Shown in header |
| Version List | Dropdown with all published versions |
| View Version | Opens read-only view of that version |
| Branch from Version | Creates new Draft from selected version |

#### 5.6.3 What the User Can Do

| Action | Trigger | Result |
|--------|---------|--------|
| Publish | Click "Publish" | Validation → confirm → publish |
| View Version | Select from dropdown | Read-only view |
| Create Branch | Click "New Draft from v3" | POST branch → new Draft |

---

### 5.7 Fan-Out Rules Editor

**Location:** Dedicated section/tab in Workflow Detail

**Purpose:** Define rules for instantiating other workflows when an outcome is recorded.

#### 5.7.1 What the User Sees

| Column | Description |
|--------|-------------|
| Source Node | Node that triggers fan-out |
| Trigger Outcome | Outcome that causes instantiation |
| Target Workflow | Workflow to instantiate |
| Status | ✓ if target is Published, ⚠ if Draft |

#### 5.7.2 What the User Can Do

| Action | Trigger | Result |
|--------|---------|--------|
| Add Rule | Click "+ Add Fan-Out Rule" | Modal → select node, outcome, workflow |
| Delete Rule | Click delete icon | DELETE rule |

**Validation:** Target workflow must be Published at publish-time.

---

## 6. Safety Rules Summary

### 6.1 Edit Restrictions

| Rule | Enforcement | Invariant |
|------|-------------|-----------|
| Published Workflows are read-only | All edit controls disabled | INV-011 |
| Validated Workflows revert to Draft on edit | Auto-revert or warn | Lifecycle |
| At least one Entry Node required | Block delete of last Entry | INV-014 |
| Outcomes must have routes before Publish | Validation error | INV-008 |

### 6.2 Deletion Cascades

| Delete | Cascades To | Warning |
|--------|-------------|---------|
| Node | Tasks, Outcomes, Gates from this Node | "This will delete X tasks and Y routes" |
| Task | Outcomes, Gates for those Outcomes | "This will delete X outcomes and Y routes" |
| Outcome | Gate for that Outcome | "This will remove the route for this outcome" |

### 6.3 Validation Blocking

| Cannot Publish If | Error Code |
|-------------------|------------|
| No Entry Node | NO_ENTRY_NODE |
| Unreachable Nodes exist | UNREACHABLE_NODE |
| Orphaned Outcomes exist | ORPHANED_OUTCOME |
| Tasks have zero Outcomes | MISSING_OUTCOMES |
| Invalid Gate targets | INVALID_GATE_TARGET |
| No terminal path | NO_TERMINAL_PATH |

---

## 7. Gap Closure Matrix

| Gap ID | Description | Closed By |
|--------|-------------|-----------|
| GAP-002 | No Workflow List View | §5.1 Workflow List Screen |
| GAP-003 | No Node Selection / Side Panel | §5.2 Node Detail Panel |
| GAP-004 | No Validation Error Display | §5.5 Validation Results Panel |
| GAP-005 | No Gate/Edge Visual Rendering | §5.4 Routing Editor (table-based) |
| GAP-007 | No Entry/Terminal Indicators | §5.2 Entry badge, §5.4 "(Terminal)" in routing |

### Intentionally Deferred to Phase 2

| Gap ID | Description | Phase 2 Requirement |
|--------|-------------|---------------------|
| GAP-001 | No Visual Graph Canvas | Canvas rendering with drag/drop |
| GAP-006 | No Node Drag/Move Capability | Spatial drag on canvas |
| GAP-009 | No Undo/Redo | Undo stack implementation |
| GAP-010 | Zoom/Pan Not Implemented | Canvas zoom/pan |
| GAP-011 | Theme Contrast for Graph | Graph-specific contrast testing |
| GAP-012 | Keyboard Accessibility for Canvas | Canvas keyboard nav |

---

## 8. Acceptance Checklist (Phase 1)

### 8.1 Workflow List

- [ ] Displays all workflows for current tenant
- [ ] Shows Name, Status, Version, Last Updated
- [ ] "New Workflow" creates Draft and navigates to detail
- [ ] Click row navigates to Workflow Detail
- [ ] Published workflows show "View" not "Edit"

### 8.2 Workflow Detail

- [ ] Shows Node list with Entry indicators
- [ ] Selecting Node shows detail panel
- [ ] Can add/edit/delete Nodes (Draft only)
- [ ] Can mark Node as Entry
- [ ] Can set Completion Rule

### 8.3 Task Management

- [ ] Selecting Node shows Tasks
- [ ] Can add/edit/delete Tasks
- [ ] Can reorder Tasks
- [ ] Can add/remove Outcomes
- [ ] Can set Evidence requirements
- [ ] Can add Cross-Flow Dependencies

### 8.4 Routing Editor

- [ ] Shows all Outcomes grouped by Node
- [ ] Dropdown to select target Node
- [ ] "(Terminal)" option available
- [ ] Orphaned Outcomes highlighted

### 8.5 Validation

- [ ] "Validate" button triggers validation
- [ ] All errors displayed with severity
- [ ] Clicking error navigates to element
- [ ] Publish blocked if errors exist

### 8.6 Publishing

- [ ] "Publish" validates first
- [ ] Confirmation modal shown
- [ ] Success creates immutable version
- [ ] Version dropdown shows all versions

---

## 9. Invariant Compliance Statement

The Structured Builder enforces all FlowSpec invariants identically to the Visual Graph Builder:

| Invariant | How Structured Builder Enforces |
|-----------|--------------------------------|
| INV-001 (No Work Outside Tasks) | All work authoring happens at Task level |
| INV-002 (Explicit Outcomes Only) | Outcomes defined in UI, validated |
| INV-003 (Gates Route Only) | Routing Editor manages Gates |
| INV-004 (No Stage-Implied Readiness) | List order has no execution meaning |
| INV-007 (Outcome Immutability) | No edit controls for runtime Outcomes |
| INV-008 (All Outcomes Routed) | Validation enforces |
| INV-011 (Published Immutable) | Edit controls disabled |
| INV-012 (Graph-First Execution) | Routing Editor, not list order |
| INV-014 (Entry Node Required) | Validation enforces |
| INV-024 (Gate Key Node-Level) | Routing Editor uses sourceNodeId |

---

**End of Document**
