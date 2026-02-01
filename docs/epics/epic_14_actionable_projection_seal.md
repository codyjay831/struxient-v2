# EPIC-14 — Actionable Projection Layer Seal

**Status:** DONE / SEALED  
**Canon Source:** `docs/canon/flowspec/01_actionable_projection_sealed.md`  
**Date Sealed:** 2026-02-01

---

## 1. Purpose

Formally lock the projection layer that bridges the FlowSpec Execution Core and the Responsibility Layer. Ensure that task delivery to the Work Station remains pure, identity-agnostic, and deterministic, preventing any drift into server-side RBAC or execution gating.

---

## 2. Completed Work

### 2.1 Identity Leakage Fix (GAP-P3-10)
- Hardened the Prisma `select` in `actionable-tasks` routes to exclude `userId` and `role`.
- Restricted `CompanyMember` projection to `id` only.
- Restricted `ExternalParty` projection to `id` and `name`.

### 2.2 Mechanical Hardening
- **Guard v2:** Created `guard_act_purity_01.mjs` with broad-spectrum token scanning and comment stripping.
- **Test v2:** Implemented `actionable_purity.test.ts` with deep-walking JSON key assertions to catch structural leaks.
- **Sort Enforcement:** Verified `T-ACT_SORT_01` integration across all projection endpoints.

### 2.3 Documentation
- Created `docs/canon/flowspec/01_actionable_projection_sealed.md`.
- Updated `docs/canon/00_sealed_subsystems_index.md`.

---

## 3. Verification Artifacts

The seal is mechanically enforced by:

- **Integration Test (Primary):** `tests/lib/responsibility/actionable_purity.test.ts` (Deep-walk purity proof).
- **CI Guard (Secondary):** `ci/guards/guard_act_purity_01.mjs` (Non-authoritative purity lint).
- **CI Guard:** `ci/guards/guard_act_red_01.mjs` (No reduction).

---

## 4. Closure Notes

The Actionable Projection Layer v1.0 is now the stable bridge between execution and responsibility. It ensures that the Work Station always receives the authoritative "Canonical Set" of work, regardless of who is asking. Future UI features (notifications, inbox, prioritization) must consume this projection without altering its non-reducing, identity-pure nature.
