# Scheduling Foundation v1.0 — CONSOLIDATED FOUNDATION

This document defines the consolidated foundation for scheduling and calendar interactions in Struxient. It establishes the relationship between task-based truth and the calendar surface, defines explicit time classes, and mandates the change behavior for schedule mutations.

## 1. Core Position (Locked)

- **Truth Engine:** Scheduling lives in **Tasks + FlowSpec**. The FlowSpec engine is the sole source of truth for when work happens.
- **Calendar Role:** The Calendar is a **lens + interaction surface**, not a scheduler. It provides a visual representation of the truth engine's state and a way to interact with it.
- **No Silent Commits:** The Calendar may request a change, but it never silently commits it to the truth engine.
- **Mutation Path:** All schedule mutations occur via **tasks / detours / outcomes**.

**Scheduling is a derived domain.** FlowSpec records schedule truth as outcomes but does not schedule or route based on time.

---

For detailed enforcement rules and laws, see: [01_scheduling_invariants_and_guards.canon.md](./01_scheduling_invariants_and_guards.canon.md)

## 2. Schedule Time Classes (Explicit, Non-Ambiguous)

The calendar must visually and semantically distinguish four time types. Every block must declare its time class; no ambiguous blocks are permitted.

| Class | Definition | Origin | Visual Semantics |
|---|---|---|---|
| **Committed** | Event-backed truth | Created only by task outcomes | Firm commitment |
| **Planned / Forecast** | Internal company intent | Capacity forecasting only | Freely adjustable; never shown as customer commitment |
| **Requested / Availability** | Constraints (Customer / Sub / Internal) | Availability windows | Constraints, not plans; cannot create commitments |
| **Suggested (AI)** | Advisory only | AI-generated suggestions | Requires explicit human confirmation |

## 3. Calendar Change Behavior

Any user interaction with the calendar (drag, edit, click) follows a strict "Right Change Path":

1. **Request:** User edit creates a `ScheduleChangeRequest`.
2. **Detour:** The request opens a **detour node / bounded task flow**.
   - Captures reason + scope.
   - Runs impact scan (derived).
   - Presents conflicts + options.
3. **Commit:** Requires explicit human confirmation to commit to the truth engine.

**Invariants:**
- No orphaned tasks.
- No silent cascades.

## 4. Conflict Model (Derived, Explainable)

Conflicts are derived facts, not blocking rules. The system must be able to explain every conflict.

### Non-Real-Time Advisory Guarantee
The conflict engine operates as an **asynchronous advisor**. It does not guarantee real-time, blocking validation of schedule intent. Instead, it provides a "best-effort" scan of current truth and intent, presenting explainable facts to the user. The system prioritizes "Never Wrong" truth over "Always Fast" conflict detection.

### Supported Conflict Categories
- **Resource overlap** (crew / sub / equipment)
- **Dependency violation**
- **Availability mismatch**
- **External window risk** (inspection, delivery)
- **Forecast pressure** (too much uncommitted work)

### Explainability Law
Every conflict must answer:
- **What** conflicts.
- **Why** it conflicts.
- **Valid resolution paths.**
- **Risk** if ignored.

## 5. Alerts & Early Warnings

The system provides proactive alerts, especially for Planned / Uncommitted work:
- “Approaching window but not committed”
- “Planned window blocked by unmet prerequisite”
- “Forecast conflict on shared resources”
- “Planned window outside availability”

**Company-configurable settings:**
- Warning thresholds (N days).
- Alert audience (roles).
- Hard vs soft conflicts.

No custom rule engines.

## 6. AI Role (Strictly Bounded)

AI is an advisory tool, not an autonomous agent for schedule truth.

- **AI May:** Suggest schedule options, explain impacts, rank risks, draft change plans.
- **AI May Not:** Auto-commit schedule truth, mutate tasks/jobs without confirmation.

## 7. Must-Haves (Customer Bar)

- **Never wrong**
- **Easy to understand**
- **Easy to change**
- **Conflict-aware**
- **Scales with chaos**

## 8. The 1–5 Rights (Foundation Laws)

1. **Right Truth** — Only tasks/events create schedule truth.
2. **Right Time Semantics** — Every time block declares its class.
3. **Right Change Path** — `Calendar → Request → Detour → Outcome`.
4. **Right Impact Awareness** — Conflicts + effects visible before commit.
5. **Right Control** — Humans confirm, system advises.
