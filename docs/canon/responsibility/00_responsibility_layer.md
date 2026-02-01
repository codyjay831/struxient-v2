# Responsibility Layer v2.1 — SEALED SUBSYSTEM

## 1. Seal Declaration

The Responsibility/Assignment Layer v2.1 is fully implemented, verified, and sealed. This subsystem provides job-level accountability metadata without affecting the core FlowSpec execution engine or the capability-based permission system.

**Status:** SEALED  
**Version:** 2.1  
**Enforcement:** Boundaries are mechanically enforced by CI guards and automated tests.

Any changes to the semantics, schema, or invariants of this layer require a new version (v2.2+) and a formal gap analysis and implementation plan.

---

## 2. What Is DONE (Locked)

The following capabilities and invariants are implemented and verified:

### 2.1 Domain Model & Storage
- **Append-only JobAssignment:** Assignments are tracked historically. Superseding an assignment involves setting `supersededAt` on existing records and inserting a new one.
- **Metadata-only ExternalParty:** Support for external entities (vendors, subs) as accountable parties. These records are tenant-scoped and strictly metadata-only.
- **Tenant Consistency:** Mechanical enforcement ensures that Job, Assigner, and Assignee all belong to the same `companyId` (Gap B fix).
- **Exactly-one Assignee:** Database and application-level constraints ensure a slot is filled by either one `PERSON` or one `EXTERNAL` party, never both or neither (Gap A fix).

### 2.2 Actionable Set Invariants
- **No Execution Gating:** Assignment status does NOT affect task actionability or the ability to record outcomes.
- **Deterministic Sort:** The `computeActionableTasks()` engine function returns tasks in a canonical order (flowId ASC, taskId ASC, iteration ASC) to ensure cross-user identity.
- **No Server-side Reduction:** API endpoints return the full canonical actionable set for all tenant members. No "My Tasks" server-side filtering.

### 2.3 API & Integration
- **Post-computation Enrichment:** Actionable task payloads are enriched with `_metadata.assignments` only after the engine has computed the authoritative set.
- **Sealed Identity Endpoint:** `/api/tenancy/me` provides the minimal identity (`memberId`, `companyId`) required for client-side UI matching, with a purity guard to prevent auth/capability leakage.

### 2.4 UI/UX (Phase 5 Option A)
- **Non-gating View Filter:** "Filter: My Assignments" toggle in the Work Station header.
- **Default State:** OFF on first load to preserve the "full canonical set" baseline.
- **Escape Hatch:** "Show All Tasks" button (1-click reset) visible when filtering is active.
- **Indicator:** "Showing X of Y" status bar providing clear visibility into the filtered vs. total actionable set.
- **Metadata Badges:** Neutral-styled badges on task rows showing assignment attribution without implying authorization.

---

## 3. What Is NOT Included (Deferred by Design)

The following items were explicitly excluded from v2.1 scope:

- **Groups / Teams:** Support for `assigneeType = GROUP` is deferred.
- **Execution Gating:** Responsibility never becomes authority. Assignments do not gate task execution.
- **Notification Outbox:** Notification dispatching based on assignment (Phase 4) remains design-only and is NOT implemented.
- **RBAC Creep:** Responsibility slots are not permissions. Capabilities remain the sole mechanism for data visibility.
- **External Party Auth:** External parties cannot log in or execute tasks in v2.1.

---

## 4. Change Control Rule

The Responsibility Layer is a high-risk drift vector for RBAC creep. Any change touching these semantics requires:
1. New version number (v2.2+).
2. Formal Gap Analysis against FlowSpec/Permission canon.
3. New/Updated CI Gates to prevent mechanical regression.
4. Explicit Canon Guardian approval.

---

## 5. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| GR-1 | Identical Actionable Set | Canonical set must be identical for all tenant members. |
| GR-2 | Observer-only Notifications | Notifications (if added) must not be triggered by Work Station. |
| GR-3 | No RBAC Creep | Slots must never be used as access control. |
| GR-4 | Explicit Semantics | Append-only supersession with tenant and assignee counts enforced. |
| GR-5 | Domain Isolation | FlowSpec Core is forbidden from importing Responsibility logic. |
| GR-6 | Join Prohibition | DB queries must never join Execution Truth with Responsibility metadata. |
| ME-PURITY | Tenancy Me Purity | `/api/tenancy/me` must not leak auth/capability context. |

---

## 6. Canon Enforcement (Governance)

CI guards are considered *authoritative canon enforcement*; failure of any listed guard constitutes a canon violation.

The following mechanical gates block any merge violating v2.1 invariants:
- **`guard_fs_iso_01.mjs`**: Blocks FlowSpec -> Responsibility imports.
- **`guard_act_red_01.mjs`**: Blocks server-side task reduction.
- **`guard_ui_sem_01.mjs`**: Blocks "authorized/permitted" language in assignment UI.
- **`workstation_determinism.test.ts`**: Authoritative gate for relative order preservation.
