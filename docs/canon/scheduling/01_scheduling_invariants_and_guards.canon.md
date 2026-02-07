# Scheduling Invariants and Guards v1.0

This document defines the non-negotiable laws governing scheduling and calendar behavior in Struxient. These laws are enforced by automated CI guards to prevent architectural drift and ensure the integrity of the scheduling truth.

## 1. The 1–5 Rights (Scheduling Laws)

The following rights are absolute laws. Any code or design that violates these rights will fail CI enforcement.

1.  **Right Truth** — Only tasks/events create schedule truth. The calendar and derived layers cannot write committed dates directly.
2.  **Right Time Semantics** — Every schedule block must explicitly declare its class (`COMMITTED`, `PLANNED`, `REQUESTED`, `SUGGESTED`). Ambiguous or default classes are prohibited.
3.  **Right Change Path** — All schedule mutations must follow the path: `Calendar → ScheduleChangeRequest → Detour/Task Flow → Outcome`. Direct updates to committed blocks are forbidden.
4.  **Right Impact Awareness** — Conflicts and downstream effects must be visible to the human operator before a change is committed. No silent cascades.
5.  **Right Control** — Humans confirm, system advises. AI and autonomous system agents are prohibited from committing schedule truth.

## 2. Prohibited Behaviors (Must-Not)

- **Silent Commits:** Updating a `COMMITTED` schedule block without an associated Task Outcome or Detour resolution.
- **Auto-Cascades:** Automatically shifting downstream schedule blocks when a dependency moves (must be a suggestion/flag).
- **Ambiguous Blocks:** Rendering or storing a schedule block without an explicit, validated `timeClass`.
- **Orphaned Changes:** Creating a schedule change that does not link back to a specific `ScheduleChangeRequest` and `DetourRecord`.
- **AI Mutator:** Allowing an AI agent to directly modify the `COMMITTED` state of any schedule block.

## 3. CI Guards (Enforcement Mechanisms)

The following conceptual guards are responsible for enforcing the 1–5 Rights.

### 3.1 `guard_schedule_truth_sources` (Right Truth)
- **Check:** No code path mutates `COMMITTED` schedule truth except through Task outcome handlers or Detour-confirmed outcomes.
- **Enforcement:** Scans for writes to schedule tables/fields. Fails if writes originate from calendar routes, UI handlers, or derived logic.

### 3.2 `guard_schedule_time_semantics` (Right Time Semantics)
- **Check:** Every schedule block has a non-nullable `timeClass` of `COMMITTED`, `PLANNED`, `REQUESTED`, or `SUGGESTED`.
- **Enforcement:** Schema validation and UI component assertions. Fails if any schedule record or UI rendering omits the class label.

### 3.3 `guard_schedule_change_path` (Right Change Path)
- **Check:** Any attempt to modify a `COMMITTED` block must create a `ScheduleChangeRequest` and open a detour.
- **Enforcement:** Static analysis for direct update function calls. Runtime tests asserting request creation on calendar interaction.

### 3.4 `guard_schedule_no_silent_cascades` (Right Impact Awareness)
- **Check:** Downstream blocks are never auto-modified when dependencies shift or failures occur.
- **Enforcement:** Simulation tests where a prerequisite fails; asserts downstream remains unchanged but is correctly flagged as "at risk."

### 3.5 `guard_schedule_human_confirmation` (Right Control)
- **Check:** Every `COMMITTED` modification requires a `confirmedBy` (human user ID) and `confirmationReason`.
- **Enforcement:** Validation on commit endpoints. Fails if system/AI actor attempts to commit truth.

## 4. Nightmare Protection Guards

- **`guard_schedule_timezone_canonicalization`**: All schedule truth must be stored in UTC/Canonical timezone. Display-only conversion only.
- **`guard_schedule_detour_capacity_reservation`**: Active detours must reserve capacity and be visible to conflict detection.
- **`guard_schedule_alert_rate_limit`**: Prevents alert spam from high-frequency availability churn.

## 5. Required System Proofs

- **Proof of Conflict:** Every conflict must be explainable (What, Why, Resolution Path, Risk).
- **Proof of Intent:** Every `PLANNED` block must be convertible to `COMMITTED` only via the Right Change Path.

## 6. Advisory Signal Scope & Performance
The system provides advisory signals (Conflicts/Alerts) as a derived background projection. 
- **Non-Real-Time:** Signals may lag behind schedule mutations. 
- **Advisory Only:** Signals never block Task Outcome recording or Detour opening. 
- **Manual Resolution:** The presence of a signal creates an affordance for manual resolution (e.g. ScheduleChangeRequest) but does not force it.
