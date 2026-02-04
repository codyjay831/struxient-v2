# 20 Simulation Harness Spec

## Goal
To provide a deterministic environment where detour scenarios can be replayed and validated against expected state transitions. The harness must be fully reproducible and parseable by automated test runners.

---

## Minimal Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `open_detour` | `checkpoint_id`, `resume_target_id`, `is_blocking`, `category?`, `required_evidence_types?` | Initialize a detour at a checkpoint. |
| `escalate_detour` | `detour_id`, `reason`, `escalated_by` | Convert a non-blocking detour to blocking. |
| `invalidate_evidence` | `node_id`, `evidence_id`, `reason` | Mark specific evidence as INVALID, triggering re-actionability. |
| `attempt_complete` | `flow_id` | Trigger the completion guard logic. Returns success or explainer message. |
| `resolve_detour` | `detour_id`, `evidence_set` | Provide required evidence to close a detour. |
| `trigger_remediation` | `detour_id`, `admin_id`, `reason` | Force a detour into a remediation loop. |
| `mark_node_complete` | `node_id`, `outcome` | Attempt to record an outcome on a node. |
| `tick_time` | `duration_seconds` | Advance simulation clock (for time-based thresholds). |

---

## Required State Output Fields

After each command, the simulation MUST output a single-line deterministic string with ALL of the following fields:

```
STATE: {flow_status} | DETOURS: [{detour_list}] | CHECKPOINT: {id} | RESUME: {id} | VALIDITY: {validity_map} | BLOCKED_NODES: [{node_list}] | ACTIONABLE: [{task_list}]
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `flow_status` | Enum | `ACTIVE`, `COMPLETED`, `BLOCKED`, `REMEDIATION_REQUIRED` |
| `detour_list` | Array | Each entry: `{id, checkpoint_id, type, status, repeat_index, duration_seconds}` |
| `checkpoint` | String | Current detour checkpoint node ID (or `null`) |
| `resume` | String | Current stable resume target node ID (or `null`) |
| `validity_map` | Object | Map of `node_id` → `VALID | PROVISIONAL | INVALID` |
| `blocked_nodes` | Array | List of node IDs that are non-actionable due to detours |
| `actionable` | Array | List of currently actionable task IDs |

---

## Determinism Rules

1. **Ordering**: When multiple detours exist (on parallel branches), they MUST be listed in order of `opened_at` timestamp (earliest first).
2. **Tie-breaking**: If two detours have identical timestamps, order by `detour_id` (lexicographic ascending).
3. **Validity precedence**: When computing blocked nodes, BLOCKING detours take precedence over NON_BLOCKING. A node is blocked if ANY upstream blocking detour exists.
4. **Evidence ordering**: Required evidence types are listed alphabetically in state output.
5. **No randomness**: All state transitions are fully deterministic given the same command sequence.

---

## Script Format (Canonical YAML)

All scenario scripts MUST use this format:

```yaml
scenario_id: "S01_PV_LABEL_MISMATCH"
description: "Non-blocking detour → completion refused → resolve → stable resume"
source_scenario: 1  # References 10_detour_examples_20_scenarios.md

initial_state:
  flow_id: "flow_001"
  nodes:
    - id: "final_inspection"
      status: "ACTIVE"
      outcome: null
    - id: "pto_submission"
      status: "PENDING"
      outcome: null
  detours: []
  validity: {}

steps:
  - step: 1
    command: "open_detour"
    params:
      checkpoint_id: "final_inspection"
      resume_target_id: "pto_submission"
      is_blocking: false
      category: "CLOSEOUT_ONLY"
      required_evidence_types: ["timestamped_photo_set", "component_checklist"]
    expected_state:
      flow_status: "ACTIVE"
      detours: [{ id: "det_001", type: "NON_BLOCKING", status: "ACTIVE" }]
      validity: { "final_inspection": "PROVISIONAL" }
      blocked_nodes: []
    assertions:
      - "detours.length == 1"
      - "validity.final_inspection == 'PROVISIONAL'"

  - step: 2
    command: "attempt_complete"
    params:
      flow_id: "flow_001"
    expected_result: "REFUSED"
    expected_explainer:
      reason_code: "ACTIVE_NONBLOCKING_DETOUR"
      message: "The job cannot be closed while the PV Label correction is active."
    assertions:
      - "result == 'REFUSED'"
      - "explainer.reason_code == 'ACTIVE_NONBLOCKING_DETOUR'"

  - step: 3
    command: "resolve_detour"
    params:
      detour_id: "det_001"
      evidence_set: ["photo_123", "checklist_456"]
    expected_state:
      flow_status: "ACTIVE"
      detours: []
      validity: { "final_inspection": "VALID" }
      blocked_nodes: []
    assertions:
      - "detours.length == 0"
      - "validity.final_inspection == 'VALID'"

  - step: 4
    command: "attempt_complete"
    params:
      flow_id: "flow_001"
    expected_result: "SUCCESS"
    assertions:
      - "result == 'SUCCESS'"
```

---

## Required Scenario Scripts

At minimum, implement these 9 scripts derived from [10_detour_examples_20_scenarios.md](./10_detour_examples_20_scenarios.md):

| Script ID | Source | Key Pattern |
|-----------|--------|-------------|
| S01 | Scenario 1 | Non-blocking → completion refused → resolve → stable resume |
| S02 | Scenario 2 | Non-blocking → escalate to blocking mid-way → block successor → resolve |
| S04 | Scenario 4 | Non-blocking → escalate → invalidate prior evidence on repeat → resolve |
| S07 | Scenario 7 | Blocking from start → repeat detour → trigger_remediation → resolve |
| S11 | Scenario 11 | Non-blocking → auto-escalate via dependency → resolve |
| S14 | Scenario 14 | Multiple branches VALID → one blocking detour → Join blocked → resolve |
| S16 | Scenario 16 | Change order mid-detour → evidence invalidated → forced remediation |
| S17 | Scenario 17 | Long-running detour → time threshold warnings |
| S20 | Scenario 20 | Escalation for safety discovery → immediate downstream lock |

---

## Per-Step Assertions

Every step MUST include explicit pass/fail assertions:

```yaml
assertions:
  - "detours.length == 1"                    # Cardinality check
  - "detours[0].type == 'BLOCKING'"          # Type check
  - "validity.node_a == 'PROVISIONAL'"       # Validity check
  - "blocked_nodes.includes('node_b')"       # Block propagation check
  - "actionable.includes('task_c') == false" # Actionability check
  - "explainer.reason_code == 'JOIN_BLOCKED'" # Explainer check
```

---

## Error Handling

Commands that violate invariants MUST return structured errors:

```yaml
error:
  code: "NESTED_DETOUR_FORBIDDEN"
  message: "Nested detours are not supported in this version."
  context:
    existing_detour_id: "det_001"
    attempted_checkpoint: "node_x"
```

---

## State Snapshot Format

For debugging, the harness MUST support exporting a full state snapshot:

```json
{
  "timestamp": "2026-02-03T10:30:00Z",
  "flow_id": "flow_001",
  "flow_status": "ACTIVE",
  "detours": [
    {
      "id": "det_001",
      "checkpoint_id": "final_inspection",
      "resume_target_id": "pto_submission",
      "type": "NON_BLOCKING",
      "status": "ACTIVE",
      "category": "CLOSEOUT_ONLY",
      "opened_at": "2026-02-03T10:00:00Z",
      "opened_by": "user_123",
      "escalated_at": null,
      "escalated_by": null,
      "repeat_index": 0,
      "required_evidence_types": ["timestamped_photo_set", "component_checklist"],
      "provided_evidence": []
    }
  ],
  "validity": {
    "final_inspection": "PROVISIONAL"
  },
  "blocked_nodes": [],
  "actionable_tasks": ["task_upload_labels"]
}
```
