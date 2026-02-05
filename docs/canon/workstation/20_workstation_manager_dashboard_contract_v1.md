# Work Station Manager Dashboard Contract v1

**Document ID:** 20_workstation_manager_dashboard_contract_v1  
**Status:** CANONICAL  
**Last Updated:** 2026-02-04  
**Visual Reference:** `workstation_manager_dashboard.html`

---

## 1. Definition

Work Station is a **decision and execution surface**. It is the primary interface for managers to identify system blockages, resolve conflicts, and approve advancements. It is NOT a passive reporting tool.

---

## 2. The Load Contract

When a Manager loads the Work Station, the interface MUST answer these three questions immediately:
1. **What is broken?** (Red/Critical Attention)
2. **What is at risk?** (Orange/At Risk)
3. **What can I ignore?** (Green/Healthy)

---

## 3. Dashboard Structure (Priority Order)

The dashboard layout must follow this hierarchy (matching the visual "north star"):

### 3.1 Signals Strip
- **Role:** High-level count of active exceptions.
- **Categories:** Blocked, At Risk, Waiting on Customer, Missing Evidence, Unassigned, Overdue.
- **Behavior:** Clicking a signal pill filters the relevant lens below.

### 3.2 Critical Attention (Capped)
- **Role:** The most urgent items requiring immediate intervention.
- **Constraint:** Capped at 10 items. Overflow must route to a filtered "All Critical" view.
- **Content:** Severity (Critical/At Risk), Category (Permit/Contract/Detour/etc.), Job Name, Reason, and a Primary Action Button.

### 3.3 Today / Tomorrow / This Week
- **Role:** Time-horizon grouping for upcoming work.
- **Grouping:** Discrete columns or sections. No combined list.
- **Behavior:** Surfaces items that are "Actionable" within that time window.

### 3.4 Job Health at a Glance
- **Role:** Tabular view of all active jobs and their current status.
- **Filters:** All, Red, Orange, Green, Needs Decision.
- **Scope Honesty:** Displays jobs with *actionable work*. Jobs with zero pending tasks are omitted from the primary dashboard view to maintain focus.
- **Mapping (INV-WS-07):**
  - **Red:** Blocking Detour or Overdue Urgent.
  - **Orange:** Overdue, Missing Evidence, Unassigned, or Due Soon.
  - **Green:** Healthy (tasks exist but no risk signals).
- **Next Decision:** A deterministic heuristic based on the highest-severity task (e.g., "Resolve Detour", "Assign Task").

### 3.5 Customer Messages (Right Rail)
- **Role:** Surfaces communication gaps.
- **Status:** **READ ONLY** (Placeholder for future Comms domain).
- **Disclaimer:** Explicitly labeled "Messaging pending" to prevent false affordance.
- **Actionability:** Linked to existing "View Job" routes.

### 3.6 Safe Navigation vs Recommended Next (Right Rail)
- **Separation:** Explicit visual split.
- **Safe Navigation:** Links to Read-only surfaces (CRM, Logs, Profiles). Label: `READ ONLY`.
- **Recommended Next:** Links to Execution surfaces (Approvals, Reassignments). Label: `EXECUTION`.

---

## 4. Tabs as Lenses

The "Lens Rule" states that each tab provides a unique perspective with its own top-of-tab alerts.

| Tab | Lens Perspective | Lens-Relevant Alert Example |
|-----|------------------|-----------------------------|
| **Overview** | Urgency & Exception | Critical Attention Grid |
| **Calendar** | Time & Conflict | Double-booking / Resource Gaps |
| **Jobs** | Pipeline & Throughput | Stage Bottlenecks |
| **Tasks** | Granular Execution | Overdue / Unassigned Lists |
| **Crews** | Personnel & Capacity | Coverage Risks / Certification Expiry |
| **Analytics** | Bottlenecks & Trends | Cycle Time Spikes |

---

## 5. Visual Invariants (from HTML)

- **Dark Mode First:** The dashboard defaults to a high-contrast dark theme (Struxient Noir).
- **Health Dots:** Must use defined Status Colors (Red `#ef4444`, Orange `#f59e0b`, Green `#10b981`).
- **Pill Tags:** Used for roles and metadata, never for primary actions.
- **No Infinite Scroll:** Lists must be discrete and route to full views for overflow.

---

**End of Document**
