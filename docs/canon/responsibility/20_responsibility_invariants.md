# Responsibility Layer v2.1 — Invariants

> Note: GR-5 and GR-6 are Responsibility-layer invariants and do not alter or renumber FlowSpec or Permission invariants.

| ID | Invariant | Description |
| :--- | :--- | :--- |
| **GR-1** | Identical Actionable Set | All members see the same total set of actionable tasks. |
| **GR-2** | Observer-only Notifications | Notifications are async and do not gate execution (Design-only). |
| **GR-3** | No RBAC Creep | Assignments never grant or deny permission to execute. |
| **GR-4** | Tenant Consistency | Job, Assigner, and Assignee must share the same `companyId`. |
| **GR-5** | Domain Isolation | FlowSpec Core is forbidden from importing Responsibility logic. |
| **GR-6** | Join Prohibition | DB queries must never join Execution Truth with Responsibility metadata. |
