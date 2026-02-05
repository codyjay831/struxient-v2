# FlowSpec Builder: How It Works & How To Change It

## 1. System Map: Builder vs Runtime

The FlowSpec Builder is a **staged design-time environment**. It operates on a "Buffer-First" principle to ensure that work-in-progress (WIP) changes do not impact the canonical relational model until the user explicitly commits them.

| Layer | Builder (Design-Time) | Runtime (Execution) |
| :--- | :--- | :--- |
| **Source of Truth** | `WorkflowDraftBuffer` (WIP) overlaying `Workflow` + `Node` + `Gate` | `WorkflowVersion` (Immutable JSON Snapshot) |
| **Persistence** | Staged (Buffer) + Autosave (Layout) | Append-only Truth Tables (`TaskExecution`, etc.) |
| **Validation** | Design-time guards (Cycles, Orphans, etc.) | Runtime guards (Purity, Isolation) |
| **Isolation** | Tenant-scoped draft space | Tenant-scoped execution space |

---

## 2. Folder & Module Map

### UI Layer
- `src/app/(app)/(fullbleed)/flowspec/[workflowId]/page.tsx`: Main orchestrator, handles state, API calls, and layout.
- `src/components/canvas/workflow-canvas.tsx`: SVG-based visualization and interaction (drag/zoom/select).
- `src/components/flowspec/node-detail-panel.tsx`: Inspector for node semantic properties and task management.
- `src/components/flowspec/routing-editor.tsx`: Matrix-style editor for outcome-to-target mapping.
- `src/components/flowspec/builder-session-sidebar.tsx`: The Right Sidebar hosting Commit/Discard and History.

### API Layer (`/api/flowspec/workflows/[id]/...`)
- `builder/route.ts`: Buffer-aware workflow fetcher.
- `commit/route.ts`: Atomic transition from Buffer to relational Truth.
- `discard/route.ts`: Wipes the draft buffer.
- `restore/route.ts`: Overwrites buffer from a historical event.
- `nodes/[nodeId]/route.ts`: Handles both semantic staging and layout autosave.

### Persistence Layer (`src/lib/flowspec/persistence/`)
- `draft-buffer.ts`: Logic for managing `WorkflowDraftBuffer` (JSON-based WIP).
- `draft-events.ts`: Append-only history of `WorkflowDraftEvent` (The Time Machine).
- `workflow.ts`: Gateway for mutating relational `Workflow`, `Node`, `Task`, `Gate` tables.

---

## 3. Builder Layout Model

The FlowSpec Builder utilizes a **Dual-Rail Workspace** model designed to maximize canvas real estate while providing structured editing surfaces.

### A) Top Bar
- **Height:** 48px (h-12).
- **Z-Index:** 60.
- **Role:** Global context (Status, Version, Identity) and high-level lifecycle (Validate, Publish).
- **Invariant:** No editing tools or property editors.

### B) Left Rails (Nodes / Config)
- **Width:** Variable (default ~520px).
- **Role:** Structural navigation and global workflow configuration (Routing, Versions, Fan-out).
- **Interaction:** Rail-based sliding panels. One panel active at a time or both closed.

### C) Canvas (Center)
- **Role:** Primary workspace. SVG-based visualization.
- **Interaction:** Zoom, pan, drag-and-drop nodes.
- **Invariant:** Must never be occluded by floating save/session UI.

### D) Right Session Sidebar
- **Width:** 360px.
- **Role:** Save safety (Commit, Discard), history browsing, and layout tools.
- **Visibility:** Collapsible, leaving a visible spine when closed.

### E) Inspector Sheet
- **Width:** 384px - 450px.
- **Z-Index:** 70 (Overlays everything).
- **Role:** Deep configuration for a single selected element (Node or Edge).

---

## 4. Interaction Rules

### Panel Exclusivity
- Only one panel per rail side can be active at a time.
- Opening a panel on the left does not automatically close a panel on the right.

### Collapse/Expand Behavior
- Panels MUST leave a visible rail affordance when collapsed to allow user re-entry.
- Canvas MUST resize dynamically when panels open/close to prevent element hiddenness.

### Canvas Resize Expectations
- The canvas engine must re-calculate its viewport and fit-to-view logic when the side panels change the available main workspace dimensions.

### Keyboard & Pointer Priority
- **Inspector (Sheet):** Captures all keyboard input when open.
- **Canvas:** Captures mouse wheel (zoom) and background drag (pan) ONLY when not hovering over an open panel or the top bar.

---

## 5. Anti-Patterns (Explicitly Forbidden)

- **Floating Save Bars:** Never place absolute-positioned save/commit buttons over the canvas. These belong in the Session Sidebar.
- **Modal Stacking for Session Safety:** Do not use full-screen modals for "Confirm Discard" or "Commit" unless they are the final step in a sidebar-initiated flow.
- **Duplicate Save State Indicators:** Do not add "Saved" or "Dirty" indicators to nodes or individual tasks. The Session Sidebar is the single source of truth for buffer state.
- **Hidden Session State:** Never hide the fact that a user is in a Draft/Dirty state. The rail MUST show a status indicator (e.g., amber dot).
- **Resizing Inspector:** Panels that require the user to manually pan the canvas just to read the label of a node they just clicked are forbidden. Use the Overlay Inspector.

---

## 6. Action Path Table

| Action | UI Element | Handler | API Route | Persistence Method | DB Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node Drag** | `WorkflowCanvas` | `onNodeDragEnd` | `PATCH .../nodes/[id]` | Direct `tx.node.update` | Relational `Node.position` (Autosave) |
| **Node Edit** | `NodeDetailPanel` | `handleSave` | `PATCH .../nodes/[id]` | `updateNodeInBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Add Node** | `CreateNodeDialog` | `handleCreate` | `POST .../nodes` | `addNodeToBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Add Task** | `CreateTaskDialog` | `handleCreate` | `POST .../tasks` | `addTaskToBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Edit Task** | `NodeDetailPanel` | `handleUpdateTask`| `PATCH .../tasks/[id]` | `updateTaskInBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Delete Task**| `NodeDetailPanel` | `handleDeleteTask`| `DELETE .../tasks/[id]` | `deleteTaskFromBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Reorder Tasks**| `NodeDetailPanel` | `onDragEnd` | `PATCH .../tasks/reorder` | `reorderTasksInBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Add Outcome** | `NodeDetailPanel` | `handleAddOutcome`| `POST .../outcomes` | `addOutcomeToBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Edit Outcome** | `NodeDetailPanel` | `handleUpdateOutcome`| `PATCH .../outcomes/[id]` | `updateOutcomeInBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Delete Outcome**| `NodeDetailPanel` | `handleDeleteOutcome`| `DELETE .../outcomes/[id]` | `deleteOutcomeFromBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Edit Gate** | `RoutingEditor` | `handleUpdateGate`| `PATCH .../gates/[id]` | `updateGateInBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Delete Gate** | `RoutingEditor` | `handleDeleteGate`| `DELETE .../gates/[id]` | `deleteGateFromBuffer` | `WorkflowDraftBuffer.content` (Staged) |
| **Commit** | `BuilderSaveStatus` | `handleCommitConfirm`| `POST .../commit` | `commitDraftToWorkflow` | relational tables replaced; `WorkflowDraftEvent` created |
| **Discard** | `BuilderSaveStatus` | `handleDiscard` | `POST .../discard` | `deleteDraftBuffer` | `WorkflowDraftBuffer` row deleted |
| **Restore** | `BuilderHistoryPanel`| `handleRestore` | `POST .../restore` | `upsertDraftBuffer` | `WorkflowDraftBuffer` overwritten from history |
| **Validate** | Header Button | `handleValidate` | `POST .../validate` | `validateWorkflowAction`| `Workflow.status` -> `VALIDATED` |
| **Publish** | Header Button | `handlePublish` | `POST .../publish` | `publishWorkflowAction` | `Workflow.status` -> `PUBLISHED`; `WorkflowVersion` created |

---

## 4. API Contracts

### GET `/api/flowspec/workflows/[id]/builder`
Returns the merged view of the workflow.
- **Request**: N/A
- **Response**: `{ workflow: WorkflowWithRelations & { _isDraft: boolean, _bufferUpdatedAt: Date } }`
- **Logic**: If buffer exists, overlays buffer `content` on top of relational nodes/gates.

### POST `/api/flowspec/workflows/[id]/commit`
Persists the buffer to the relational database.
- **Request**: `{ label?: string }`
- **Response**: `{ message: string, eventId: string, seq: number }`
- **Logic**: 
  1. Capture current relational state.
  2. Create `WorkflowDraftEvent`.
  3. Wipe and replace relational `Node`/`Task`/`Gate` rows.
  4. Update buffer `baseEventId`.

### PATCH `/api/flowspec/workflows/[id]/nodes/[nodeId]`
Updates node properties.
- **Request**: `{ name?, isEntry?, nodeKind?, completionRule?, position? }`
- **Logic**: 
  - If `position` is provided: Updates `Node` table directly (Autosave).
  - If semantic fields are provided: Updates `WorkflowDraftBuffer.content` (Staged).

---

## 5. Data Model Roles (Prisma)

### Workflow + Nodes + Tasks + Gates
These represent the **Canonical Relational Truth**. They are used by the runtime engine (after publishing) and as the base for the builder.
- **Node.position**: Design-time only field. Bypasses buffer for responsive autosave.

### WorkflowDraftBuffer
A JSON-based WIP storage. Exactly one per workflow per tenant.
- **content**: Stores the `WorkflowSnapshot` (Nodes, Tasks, Gates) currently being edited.
- **baseEventId**: Points to the historical event this buffer diverged from.

### WorkflowDraftEvent
Append-only history log.
- **snapshot**: A full composite JSON (Semantic + Layout) representing a "checkpoint" in time.
- **type**: `INITIAL` (first save), `COMMIT` (user saved), `RESTORE` (reverted from history).

---

## 6. Invariants & Guardrails

1.  **Buffer-First Rendering**: The builder UI must always prioritize buffer content over relational tables for semantic state.
2.  **Union Merge**: When rendering, if a node exists in both Truth and Buffer, the Buffer fields win. If it exists only in Truth, it is shown (unless deleted in buffer).
3.  **Layout vs Semantic**: Layout changes (dragging) are **not** staged; they are live. **All semantic edits (Nodes, Tasks, Outcomes, Gates) stage to WorkflowDraftBuffer; only layout writes to relational tables outside commit.**
4.  **Atomic Commit**: Committing a draft is a "wipe and replace" operation inside a single transaction. It preserves IDs to maintain external references.
5.  **Runtime Engine Isolation**: The runtime engine (`src/lib/flowspec/engine.ts`) must **never** read from `WorkflowDraftBuffer`. It only reads from `WorkflowVersion`.
6.  **Buffer Lifecycle after Discard (INV-027)**: After `POST /discard` deletes the buffer, the next semantic edit MUST recreate/seed the buffer automatically. 
    - If history exists: Anchor to the latest `WorkflowDraftEvent` (baseEventId).
    - If no history: Create an `INITIAL` event with an allocated sequence.
7.  **Managed Sequencing**: `WorkflowDraftEvent.seq` is application-managed. Hardcoded sequences (e.g. `seq: 1`) are forbidden except during initial bootstrap, and even then must be verified against current history to prevent unique constraint violations.
8.  **Transaction Pass-Through**: Any persistence helper that can be called inside an API transaction (e.g., `ensureDraftBuffer`, `findWorkflowById`, semantic mutation helpers) **must** accept a Prisma transaction client (`tx`) and use it if provided. Never start a new transaction if one is already in progress.

---

## 7. Common Failure Modes & Debug Checklist

### 1. "Changes didn't save" (Semantic)
- **Check**: Is the buffer row created in `WorkflowDraftBuffer`?
- **Verify**: Inspect `POST /api/flowspec/workflows/[id]/commit` network response.
- **Root Cause**: Often a linter/guard error in the persistence layer preventing the transaction from finishing.

### 2. "Nodes moved back after refresh"
- **Check**: Did `PATCH .../nodes/[id]` succeed?
- **Verify**: Does the `Node` table in the DB have the correct `position` JSON?
- **Root Cause**: Network failure during drag-end or `position` field being accidentally included in a semantic stage instead of the direct write.

### 3. "Canvas is empty or crashed"
- **Check**: `GET .../builder` response.
- **Verify**: Is `workflow.nodes` an array?
- **Root Cause**: `Union merge` logic in `builder/route.ts` failing due to malformed JSON in the draft buffer.

### 4. "Buttons are unclickable"
- **Check**: CSS `pointer-events-none` on overlay containers.
- **Verify**: Z-index of `.fixed` header vs canvas.
- **Root Cause**: The Header Overlay `fixed` container often blocks the canvas if `pointer-events: none` isn't applied to the container itself (allowing clicks to pass through to buttons).

### 5. "Commit/Discard never enable"
- **Check**: `GET .../builder` response for `_isDraft: true`.
- **Verify**: `semanticDiff` length in `page.tsx`.
- **Root Cause**: Semantic route bypasses buffer or throws → UI stays ‘All changes committed’ → Commit/Discard disabled.

### 6. "Discard → next semantic edit 500"
- **Check**: Server console for `Unique constraint failed (workflowId, seq)` or `Transaction nested` errors.
- **Verify**: `POST /api/flowspec/workflows/[id]/discard` followed by any semantic edit (e.g., Add Task).
- **Root Cause**: Buffer seeding logic attempting to recreate `INITIAL` event with `seq: 1` when history already exists, or failing to pass the transaction client to the seeding helper.
- **Fix**: Use history-aware seeding (find latest seq) and ensure `tx` pass-through in `draft-buffer.ts`.

---

## 8. Proof Checklist

To verify that the builder session authority is working correctly:

- **After semantic edit** (e.g. rename task):
  - `GET /api/flowspec/workflows/[id]/builder` must return `_isDraft: true`.
  - Header must show "You have X unsaved changes".
  - Commit and Discard buttons must be enabled.
- **After commit**:
  - `POST /api/flowspec/workflows/[id]/commit` returns `200 OK`.
  - `GET /api/flowspec/workflows/[id]/builder` returns `_isDraft: false`.
  - Header must show "All changes committed".
  - Commit and Discard buttons must be disabled.
- **After Discard & Edit** (Regression: `tests/lib/flowspec/buffer_lifecycle.test.ts`):
  - `POST /api/flowspec/workflows/[id]/discard` returns `200 OK`.
  - Next semantic edit (e.g., `POST /tasks`) returns `201 Created`.
  - `GET /builder` returns `_isDraft: true` and the new task is present.
  - History (`WorkflowDraftEvent`) remains unchanged from before the edit.

---

## 8. "How to Safely Change X" Recipes

### To add a new UI control (e.g., "Duplicate Node")
1.  Add button to `NodeDetailPanel`.
2.  Create new API route or add `POST` to `nodes/route.ts`.
3.  Implement `duplicateNodeInBuffer` in `draft-buffer.ts`.
4.  Refresh workflow state in UI after success.

### To add a new field to Nodes (e.g., "Color")
1.  Update Prisma `Node` model (relational) AND `WorkflowSnapshot` type (JSON).
2.  Update `builder/route.ts` merge logic to handle the new field.
3.  Update `commitDraftToWorkflow` in `workflow.ts` to persist the field from JSON to relational.

### To change the Commit logic
1.  Modify `src/lib/flowspec/persistence/workflow.ts` -> `commitDraftToWorkflow`.
2.  Ensure you maintain the `tx` (transaction) pass-through pattern.
3.  Verify that `createCommitEvent` still captures the correct composite snapshot.

---

## 10. Drift Prevention Checklist

This checklist MUST be consulted by any developer or AI agent before introducing UI changes to the FlowSpec Builder.

- [ ] **Rail Alignment:** If adding a new feature or panel, does it belong on the **Left Rail** (Structure/Config) or the **Right Rail** (Session/State)?
- [ ] **Save Location:** If adding save/persist controls, do they live in the **Session Sidebar**? (No floating canvas bars!)
- [ ] **Interaction Priority:** Does the new UI use the **Inspector Sheet** (overlay) or a **Rail Panel** (sidebar)? (Favor Inspector for element-specific edits).
- [ ] **Canvas Obstruction:** Does the new UI element obstruct the central canvas workspace without a clear path to collapse/close?
- [ ] **Z-Index Check:** Does the new element respect the hierarchy: `Inspector (70)` > `Top Bar (60)` > `Rails (20)`?
- [ ] **Immutability:** If viewing a Published workflow, is the new UI correctly disabled or hidden?
- [ ] **Mobile/Compact:** Does the new UI preserve the `data-density="compact"` attribute and standard spacing?
