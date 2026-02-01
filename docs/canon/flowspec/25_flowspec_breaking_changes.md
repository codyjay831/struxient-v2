# FlowSpec Breaking Change Rules

**Document ID:** 25_flowspec_breaking_changes  
**Status:** CANONICAL  
**Last Updated:** 2026-02-01  
**Related Documents:**
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [20_flowspec_invariants.md](./20_flowspec_invariants.md)

---

## 1. Purpose

This document defines the rules for identifying and managing "Breaking Changes" within the FlowSpec system. Because FlowSpec follows a **Pin-at-Creation, Resolve-at-Trigger** model, in-flight jobs can become "entangled" across different workflow versions. These rules ensure that workflow updates do not inadvertently stall or corrupt active work.

---

## 2. The Workflow Contract Surface

A Workflow is more than a standalone graph; it exposes a "Contract Surface" that downstream flows and parallel processes depend upon. The following elements constitute this surface:

| Element | Description | Dependency Type |
|---------|-------------|-----------------|
| **Outcome Names** | Explicit result strings (e.g., `APPROVED`) | Cross-Flow Dependencies |
| **Fan-out Triggers** | Node IDs that trigger new flows | Sequencing / Lifecycle |
| **Task Paths** | Dot-notated paths (e.g., `NodeA.Task1`) | Cross-Flow Dependencies |
| **Join Semantics** | Node completion rules (e.g., `ALL_TASKS_DONE`) | Downstream Assumptions |

---

## 3. Catalog of Breaking Changes

A change is "Breaking" if it prevents an in-flight Flow from progressing or satisfies a dependency incorrectly.

### 3.1 Outcome Renaming
*   **Action:** Changing `APPROVED` to `SIGNED`.
*   **Mechanism:** Cross-flow dependencies in parallel flows use literal string matching. Existing flows waiting for `APPROVED` will never receive the signal from a newer version recording `SIGNED`.
*   **Human Symptom:** Downstream work stays permanently non-actionable (Silent Stall).

### 3.2 Deleting/Recreating Fan-out Nodes
*   **Action:** Deleting a Node that triggers a fan-out and creating a new one with the same name.
*   **Mechanism:** `FanOutRule` records are often keyed by internal Node IDs. Recreating the node generates a new ID, effectively deleting the trigger for any flow still running on the old version.
*   **Human Symptom:** The job completes its current phase, but no downstream flows are instantiated.

### 3.3 Moving/Renaming Task Paths
*   **Action:** Moving Task `T1` from Node `A` to Node `B`.
*   **Mechanism:** Cross-flow dependencies reference tasks via paths (e.g., `NodeA.T1`). If the path changes, the engine cannot resolve the outcome from the new version to satisfy the old version's dependency.
*   **Human Symptom:** Jobs stall as they wait for an outcome from a path that no longer exists in the latest version.

### 3.4 Join Semantic Shifts (ALL → ANY)
*   **Action:** Changing a Node completion rule from `ALL_TASKS_DONE` to `ANY_TASK_DONE`.
*   **Mechanism:** Downstream nodes or flows assume they only start when *all* data from the source node is ready. If changed to `ANY`, downstream work starts prematurely with missing data.
*   **Human Symptom:** Premature execution; tasks appear in the Work Station before their required pre-requisites are finished.

---

## 4. Catalog of Safe Changes

The following changes are considered safe and do not impact the execution contract:

*   **Instructional Content:** Updating `instructions` text, URLs, or help documentation.
*   **UI Metadata:** Changing the `position` of nodes in the Builder or `displayOrder` of tasks.
*   **Leaf Node Additions:** Adding new Nodes or Tasks that no existing Gate or Fan-out Rule depends on.
*   **Evidence Schema Tightening:** Adding MIME type restrictions or length constraints (while potentially frustrating, this does not break the execution graph).

---

## 5. “No Silent Stall” Policy

Struxient maintains a "No Silent Stall" policy. The system must eventually provide mechanical protections (via the Builder or CI) to prevent or loudly warn when a structural edit threatens active jobs.

1.  **Contract Awareness:** The Builder should warn if an Outcome or Task being renamed is currently targeted by an active Cross-Flow Dependency.
2.  **Tombstoning:** If a Node triggering a Fan-out is deleted, its trigger rule should be "tombstoned" (maintained) until all flows using that version have terminated.
3.  **Impact Warnings:** Before publishing structural changes, the system should provide a loud, non-blocking warning surface.
    - **Detection:** If analysis is available, specific breaking changes (renames, deletions) MUST be highlighted with affected flow counts.
    - **Non-Blocking:** Impact warnings are advisory. If analysis is unavailable or risks are acknowledged, the user MUST be permitted to proceed with publishing.

---

## 6. Open Questions

The following questions remain open and are not yet defined in Canon:

*   **Version-Scoped Fan-out?** Should fan-out rules be stored inside the version snapshot rather than at the workflow level?
*   **Outcome Aliasing?** Should outcomes support "Legacy Aliases" so that `SIGNED` can satisfy a dependency for `APPROVED`?
*   **Version Pinning?** Should a Flow Group optionally be allowed to pin *all* future fan-outs to a specific version set to prevent mid-job drift?

---

**End of Document**
