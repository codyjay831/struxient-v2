# Actionable Projection Layer v1.0 — SEALED SUBSYSTEM

## 1. Seal Declaration

The Actionable Projection Layer (Version 1.0) is formally implemented, verified, and sealed. This layer is responsible for projecting FlowSpec actionable tasks to the Work Station, enriched with Responsibility Layer metadata, while strictly preserving the authority and isolation of the underlying subsystems.

**Status:** SEALED  
**Version:** 1.0  
**Date Sealed:** 2026-02-01  
**Scope:**
- `src/app/api/flowspec/actionable-tasks/route.ts` (Global Tenant Projection)
- `src/app/api/flowspec/flow-groups/[id]/actionable-tasks/route.ts` (Scoped Group Projection)
- `src/lib/flowspec/derived.ts` (`computeActionableTasks` sorting)

---

## 2. Sealed Invariants

The following invariants are mechanically locked and enforced by CI guards:

### 2.1 Canonical Set Integrity (GR-1)
- **No Reduction:** Actionable task sets are never reduced or filtered by member identity, assignments, or roles.
- **Compute-First, Enrich-After:** The authoritative actionable set is computed by the FlowSpec engine core before any responsibility metadata is attached.
- **Payload Parity:** All members of a tenant receive the identical set of actionable tasks (subject to canonical sorting).

### 2.2 Determinism & Canonical Identity
- **Deterministic Ordering:** Results are strictly sorted by `flowId ASC`, `taskId ASC`, and `iteration ASC`.
- **Stable Identity:** Tasks are identified by a stable set of fields: `flowId`, `flowGroupId`, `workflowId`, `taskId`, `nodeId`, and `iteration`.
- **Metadata Separation:** Responsibility metadata is stored under the `_metadata` key and is strictly advisory; it is never used for execution-gating logic.

### 2.3 Identity Purity & Isolation
- **Minimal Projection:** Assignment metadata is restricted to minimal identity pointers.
    - **PERSON:** Includes only `id` (CompanyMember.id).
    - **EXTERNAL:** Includes only `id` and `name`.
- **Forbidden Leaks:** Sensitive fields such as `userId`, `role`, `capabilities`, or `permissions` are strictly forbidden from the projection payload.

---

## 3. CI Enforcement & Verification

The following mechanical gates block any merge that violates these invariants:

### 3.1 CI Guards (Secondary Lint)
- **`ci/guards/guard_act_purity_01.mjs`**: Non-authoritative lint scanning for forbidden identity tokens. Strips comments before scanning.
- **`ci/guards/guard_act_red_01.mjs`**: Prevents server-side reduction/filtering of tasks by identity.
- **`ci/guards/guard_no_my_actionable_01.mjs`**: Blocks the creation of "convenience" identity-filtered endpoints.

### 3.2 Automated Tests (Primary Enforcement)
- **`tests/lib/responsibility/actionable_purity.test.ts`**: **Primary Gate.** Deep-walks the response JSON and asserts no forbidden keys exist under `_metadata.assignments`. Verifies minimal shape for PERSON and EXTERNAL assignees.
- **`tests/lib/flowspec/phase3_guards.test.ts`**: Verifies canonical sorting and metadata-agnostic actionable sets.

---

## 4. Change Control Rule

Any modification to a SEALED subsystem requires:
1. **Seal Breach Proposal:** A formal RFC explaining the necessity of the change.
2. **Passing Guards/Tests:** All existing purity, non-reduction, and sorting guards must remain green.
3. **Explicit Canon Guardian Approval.**

---

## 5. API Interface (Public)

| Endpoint | Role | Filtering | Enrichment |
|---|---|---|---|
| `GET /api/flowspec/actionable-tasks` | Global Tenant Feed | Tenant-only | `_metadata.assignments` |
| `GET /api/flowspec/flow-groups/[id]/actionable-tasks` | Scoped Group Feed | Tenant + Group | `_metadata.assignments` |
