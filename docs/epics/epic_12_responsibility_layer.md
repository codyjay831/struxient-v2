# epic_12_responsibility_layer.md

**Epic ID:** EPIC-12  
**Title:** Responsibility / Assignment Layer v2.1  
**Status:** DONE / SEALED  
**Canon Sources:** 00_responsibility_layer.md, 10_workstation_contract.md

---

## 1. Purpose

Add a metadata layer to Jobs that allows attributing accountability (PM, Sales Lead, etc.) to Persons or External Parties. This layer is strictly for notifications, reporting, and UI filtering, and MUST NOT gate execution or change permissions.

---

## 2. Completed Work (v2.1)

### 2.1 Phase 1: Domain Model & Storage
- Implemented `JobAssignment` and `ExternalParty` models.
- Enforced "exactly-one assignee" via DB CHECK constraint.
- Enforced tenant consistency (Job/Assigner/Assignee) via transactional validation.
- Status: **DONE**

### 2.2 Phase 2: API Surfaces
- Created `/api/jobs/[id]/assignments` for managing metadata.
- Enriched `/api/flowspec/actionable-tasks` with `_metadata.assignments` post-computation.
- Created `/api/tenancy/me` for minimal client-side identity.
- Status: **DONE**

### 2.3 Phase 3: Boundary Guards & Canonical Sort
- Implemented canonical sort in `computeActionableTasks()` (flowId, taskId, iteration).
- Added 7 CI guards to prevent coupling and server-side reduction.
- Status: **DONE**

### 2.4 Phase 5: Work Station Integration (Option A)
- Added "Filter: My Assignments" toggle to Work Station header.
- Implemented client-side filtering and "Showing X of Y" indicator.
- Added neutral metadata badges to task feed rows.
- Status: **DONE**

---

## 3. Deferred Work (Design Only)

### 3.1 Phase 4: Notifications
- The Notification Outbox pattern was designed but NOT implemented in v2.1.
- All notification triggering remains out of scope for the Work Station.

---

## 4. Final Notes / Closure

The Responsibility Layer v2.1 is fully implemented and sealed. 
- Phases completed: 1, 2, 3, 5.
- Option A UI spec implemented exactly.
- All boundaries mechanically enforced by CI guards.

---

## 5. Future Work (Out of Scope)

**WARNING:** Do not attempt to extend this subsystem via "small tweaks". It is a high-risk drift vector.

- **Groups:** Deferred to v2.2.
- **Auto-assignment:** Deferred to v2.2.
- **Notification Engine:** Deferred to v2.2.

For details on the sealed boundaries, see: `docs/canon/responsibility/00_responsibility_layer.md`
