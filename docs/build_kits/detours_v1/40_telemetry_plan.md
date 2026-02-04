# 40 Telemetry Plan

## Goal
To measure the health and efficiency of the detour system and identify systemic failures in the field. This telemetry must enable building operational dashboards and alerting on anomalies.

---

## Event Catalog

### Core Events

| Event Name | Emitted When | Cardinality |
|------------|--------------|-------------|
| `detour.opened` | A new detour record is created | 1 per detour |
| `detour.escalated` | A detour moves from NON_BLOCKING to BLOCKING | 1 per escalation |
| `detour.resolved` | A detour is successfully closed with valid evidence | 1 per resolution |
| `detour.invalidated` | Evidence on a detour is marked INVALID | 1 per invalidation |
| `detour.converted_to_remediation` | A detour is converted to a remediation loop | 1 per conversion |
| `detour.stalled` | A detour exceeds the time threshold (first occurrence) | 1 per stall |
| `completion.refused` | Flow or node completion was refused by guard | 1 per refusal |

### Timing

| Event | Exact Trigger Point |
|-------|---------------------|
| `detour.opened` | After successful `open_detour` command, before response |
| `detour.escalated` | After `escalate_detour` commits, includes `escalated_by` and `reason` |
| `detour.resolved` | After `resolve_detour` commits with valid evidence |
| `detour.invalidated` | After `invalidate_evidence` commits, before re-actionability recalc |
| `detour.converted_to_remediation` | After `trigger_remediation` commits |
| `detour.stalled` | On first `tick_time` where `duration > stall_threshold` |
| `completion.refused` | After guard rejects, includes `reason_code` from explainer |

---

## Event Schema

### detour.opened

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | UUID | Yes | Unique event identifier |
| `timestamp` | ISO8601 | Yes | When event occurred |
| `detour_id` | UUID | Yes | Unique ID of the detour |
| `flow_id` | UUID | Yes | Parent flow |
| `flow_group_id` | UUID | Yes | Parent flow group (job) |
| `checkpoint_node_id` | String | Yes | Node where detour originated |
| `resume_target_node_id` | String | Yes | Stable resume target |
| `type` | Enum | Yes | `NON_BLOCKING`, `BLOCKING` |
| `category` | String | No | `CLOSEOUT_ONLY`, `SAFETY`, `COMPLIANCE`, etc. |
| `trade` | String | Yes | Trade involved (Electrical, Solar, HVAC, etc.) |
| `template_id` | UUID | Yes | Workflow template ID |
| `company_id` | UUID | Yes | Tenant/company ID |
| `opened_by` | UUID | Yes | User who opened detour |
| `is_late_entry` | Boolean | Yes | True if downstream work already started |
| `required_evidence_types` | Array | No | List of required evidence types |

### detour.escalated

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | UUID | Yes | Unique event identifier |
| `timestamp` | ISO8601 | Yes | When event occurred |
| `detour_id` | UUID | Yes | Detour being escalated |
| `flow_id` | UUID | Yes | Parent flow |
| `company_id` | UUID | Yes | Tenant/company ID |
| `escalated_by` | UUID | Yes | User who escalated |
| `reason` | String | Yes | Escalation reason text |
| `previous_type` | Enum | Yes | `NON_BLOCKING` |
| `new_type` | Enum | Yes | `BLOCKING` |
| `is_policy_escalation` | Boolean | Yes | True if triggered by admin policy change |
| `is_safety_escalation` | Boolean | Yes | True if triggered by safety finding |

### detour.resolved

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | UUID | Yes | Unique event identifier |
| `timestamp` | ISO8601 | Yes | When event occurred |
| `detour_id` | UUID | Yes | Detour being resolved |
| `flow_id` | UUID | Yes | Parent flow |
| `company_id` | UUID | Yes | Tenant/company ID |
| `resolved_by` | UUID | Yes | User who resolved |
| `duration_seconds` | Integer | Yes | Time from opened to resolved |
| `repeat_index` | Integer | Yes | How many times this checkpoint had detours |
| `evidence_count` | Integer | Yes | Number of evidence items provided |

### completion.refused

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | UUID | Yes | Unique event identifier |
| `timestamp` | ISO8601 | Yes | When event occurred |
| `flow_id` | UUID | Yes | Flow where completion was refused |
| `company_id` | UUID | Yes | Tenant/company ID |
| `action_attempted` | String | Yes | `COMPLETE_FLOW`, `COMPLETE_NODE`, etc. |
| `reason_code` | Enum | Yes | From explainer contract |
| `blocking_entity_id` | String | Yes | ID of blocking detour/node/evidence |
| `attempted_by` | UUID | Yes | User who attempted completion |

---

## Computed Metrics

These are derived from events, not emitted directly:

| Metric | Computation | Aggregation |
|--------|-------------|-------------|
| `detour_repeat_count` | Count of `detour.opened` per checkpoint_node_id per flow | Per job |
| `time_to_resolve` | `resolved.timestamp - opened.timestamp` | Histogram |
| `escalation_rate` | `escalated.count / opened.count` | Per company, per trade |
| `late_entry_rate` | `opened.where(is_late_entry).count / opened.count` | Per template |
| `stall_rate` | `stalled.count / opened.count` | Per trade |

---

## Dimensions for Analysis

All events should support filtering/grouping by:

| Dimension | Description |
|-----------|-------------|
| `company_id` | Tenant isolation |
| `trade` | Electrical, Solar, HVAC, Plumbing, etc. |
| `template_id` | Workflow template |
| `workflow_id` | Specific workflow instance |
| `node_id` | Checkpoint node |
| `category` | Detour category (CLOSEOUT_ONLY, SAFETY, etc.) |
| `ahj_id` | Authority Having Jurisdiction (if applicable) |
| `job_type` | Residential, Commercial, Multi-family, etc. |
| `date` | Day/Week/Month for time-series |

---

## Alert Thresholds

| Alert | Condition | Severity |
|-------|-----------|----------|
| Repeat Detour | `repeat_index > 2` at same checkpoint on single job | Warning |
| Resolution Lag | `duration_seconds > 2x` standard task duration for trade | Warning |
| Escalation Spike | `> 20%` of non-blocking escalated to blocking in 24h window | Critical |
| Blocking Overload | Any job with `> 3` concurrent blocking detours | Critical |
| Stall Threshold | Detour open `> 14 days` without resolution | Warning |
| Evidence Rejection Spike | `> 10%` of evidence uploads marked INVALID in 24h | Warning |
| Explainer Coverage Gap | Any `EXPLAINER_COVERAGE_GAP` logged | Critical |

---

## Required Dashboards

The telemetry must enable building these dashboards:

### 1. Detour Health Overview
- Total detours opened (by day/week)
- Breakdown by type (blocking vs non-blocking)
- Average time-to-resolve by trade
- Escalation rate trend

### 2. Stalled Corrections
- List of all detours open > 14 days
- Grouped by company, sorted by duration
- Shows blocking_entity_id and required_actions

### 3. Repeat Offenders
- Checkpoints with highest repeat_index
- By template and trade
- Indicates "symptom-not-cause" patterns

### 4. Completion Refusals
- Count of refusals by reason_code
- By company and trade
- Identifies common blockers

### 5. Safety Escalations
- All `is_safety_escalation = true` events
- Time from discovery to escalation
- Near-miss analysis

---

## Implementation Notes

1. **Event ordering**: Events must be emitted after transaction commit to ensure consistency.
2. **Idempotency**: `event_id` ensures deduplication if replay is needed.
3. **Retention**: Keep raw events for 90 days; aggregate metrics indefinitely.
4. **Privacy**: No PII in events; use opaque UUIDs for user references.
