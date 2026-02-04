# 60 Debug Panel Read-Only Spec

## Goal
To provide developers and admins with a clear, non-interactive visualization of the current detour and validity state. This is a diagnostic tool, not an operational interface.

**All "why blocked" messages MUST come from the Explainer Contract. No bespoke logic.**

---

## Minimum Required Fields per Detour Row

Every detour displayed MUST show these fields:

| Field | Source | Description |
|-------|--------|-------------|
| `detour_id` | DetourRecord | Unique identifier |
| `checkpoint_node_id` | DetourRecord | Node where detour originated |
| `checkpoint_node_name` | Node lookup | Human-readable node name |
| `resume_target_node_id` | DetourRecord | Stable resume target |
| `resume_target_node_name` | Node lookup | Human-readable resume target name |
| `type` | DetourRecord | `BLOCKING` or `NON_BLOCKING` |
| `category` | DetourRecord | `CLOSEOUT_ONLY`, `SAFETY`, `COMPLIANCE`, etc. |
| `status` | DetourRecord | `ACTIVE`, `RESOLVED`, `CONVERTED_TO_REMEDIATION` |
| `opened_at` | DetourRecord | ISO8601 timestamp |
| `opened_by` | DetourRecord + User lookup | User name who opened |
| `escalated_at` | DetourRecord | ISO8601 timestamp (or null) |
| `escalated_by` | DetourRecord + User lookup | User name who escalated (or null) |
| `escalation_reason` | DetourRecord | Reason text (or null) |
| `repeat_index` | Computed | Count of detours at this checkpoint |
| `duration` | Computed | Human-readable time since opened |
| `required_evidence_types` | DetourRecord | List of required evidence |
| `provided_evidence_count` | DetourRecord | Count of evidence items attached |

---

## Layout Requirements

### 1. Active Detours Section
- **Position**: Top of panel, always visible.
- **Content**: List of all ACTIVE detours for the current flow.
- **Sorting**: By `type` (BLOCKING first), then by `opened_at` (oldest first).
- **Visual cues**:
  - BLOCKING: Red left border, 🛑 icon
  - NON_BLOCKING: Yellow left border, ⚠️ icon
  - Stalled (>14 days): Pulsing amber background

### 2. Checkpoint/Resume Visualization
- **Position**: Below Active Detours.
- **Content**: Mini-map or breadcrumb showing:
  - Checkpoint node (where detour originated)
  - Resume target node (where flow will continue)
  - Arrow connecting them
- **Interaction**: Click node name to jump to node in main canvas (if applicable).

### 3. Validity Grid
- **Position**: Middle section.
- **Content**: Table showing all nodes in the flow.
- **Columns**:
  - Node Name
  - Base State (PENDING, ACTIVE, DONE)
  - Validity (VALID, PROVISIONAL, INVALID)
  - Blocking Detour ID (if blocked)
- **Visual cues**:
  - VALID: Green checkmark
  - PROVISIONAL: Yellow dashed border, ⏳ icon
  - INVALID: Red strikethrough, ❌ icon

### 4. Blocked Nodes List
- **Position**: Below Validity Grid.
- **Content**: List of nodes that are currently non-actionable due to detours.
- **Per node**:
  - Node name
  - "Why Blocked" message (from Explainer Contract)
  - ReasonCode badge
  - Blocking entity ID (detour or upstream node)
- **Requirement**: The "Why Blocked" text MUST be the exact output from the Explainer Contract. No custom messages.

---

## Key Constraints

- **Read-Only**: No buttons to resolve, open, escalate, or modify detours.
- **No Write Actions**: All state changes must go through the standard command pathways.
- **Explainer Contract Only**: All "why blocked" messages must come from calling the explainer; no bespoke panel logic.
- **Refresh**: Panel should auto-refresh on any detour state change or support manual refresh button.

---

## "Copy as Text" Block

For support ticket generation, the panel MUST provide a "Copy Debug State" button that copies a text block:

```
=== DETOUR DEBUG STATE ===
Flow ID: flow_001
Flow Status: ACTIVE
Timestamp: 2026-02-03T10:30:00Z

ACTIVE DETOURS (1):
- [det_045] BLOCKING at "Electrical Rough" → "Drywall Release"
  Opened: 2026-02-01T09:00:00Z by user_123 (2 days ago)
  Escalated: 2026-02-02T14:00:00Z by user_456
  Reason: "Safety issue discovered during bonding fix"
  Repeat Index: 1
  Required Evidence: photo, continuity_test
  Provided Evidence: 0

VALIDITY OVERLAY:
- Electrical Rough: PROVISIONAL
- HVAC Rough: VALID
- Drywall Release: BLOCKED (by det_045)

BLOCKED NODES (1):
- Drywall Release
  Reason: ACTIVE_BLOCKING_DETOUR
  Message: "Work is paused on Drywall Release until the correction at Electrical Rough is resolved."
  Blocking Entity: det_045

=== END DEBUG STATE ===
```

---

## Visual Descriptions (Mockups)

### Blocked Node
- Background: Light gray (desaturated)
- Icon: Red padlock 🔒
- Hover: Tooltip shows Explainer Message
- Click: Expands to show full ReasonCode and required_actions

### Provisional State
- Background: Light yellow (#FFF9C4)
- Border: 2px dashed orange
- Icon: Hourglass ⏳
- Tooltip: "Outcome is provisional pending detour resolution"

### Invalid State
- Background: Light red (#FFEBEE)
- Text: Strikethrough on prior outcome value
- Icon: Red X ❌
- Tooltip: "Evidence was rejected; replacement required"

### Active Detour Card
- Position: Floating card pinned to right side of panel
- Content:
  - Detour type badge (BLOCKING/NON_BLOCKING)
  - Checkpoint → Resume arrow
  - Duration counter
  - Required Actions list (from Explainer)
  - Evidence progress bar (provided/required)

---

## Source-of-Truth Mapping

| UI Element | Data Source |
|------------|-------------|
| Detour list | `DetourRecord` table |
| Validity values | `ValidityOverlay` derived state |
| Blocked nodes | `computeBlockedNodes()` function |
| Why Blocked | `Explainer.explain(action, state)` |
| Required Actions | `Explainer.explain().required_actions` |

---

## Implementation Notes

1. **No secrets**: This panel is for debugging; do not expose PII or secrets.
2. **Performance**: Cache Explainer calls; don't recompute on every render.
3. **Permissions**: Require admin or developer role to access.
4. **Audit**: Log every panel access for security review.
