# Tenancy Contract

**Status:** LOCKED  
**Version:** 1.0  
**Last Updated:** 2026-01-28

---

## 1. Canonical Statement

> **Struxient is a strictly multi-tenant SaaS. Every resource belongs to a Company (Tenant). Every actor MUST have a membership in a Company to access or create any multi-tenant data. No "global fallback" or "unaffiliated" data exists in production.**

---

## 2. Membership Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| T-INV-001 | No Anonymous Access | All multi-tenant APIs MUST verify membership before processing. |
| T-INV-002 | Deterministic Error | Membership absence MUST return `403 Forbidden` with code `NO_MEMBERSHIP`. |
| T-INV-003 | Single Tenant View | In v2, an actor interacts with one Company at a time (determined by session/membership). |
| T-INV-004 | Ownership on Creation | New resources (Workflows, Flows) inherit the `companyId` of the creator. |

---

## 3. Onboarding & Provisioning

### 3.1 Production Onboarding
- Users with no membership MUST be directed to an onboarding flow.
- The onboarding flow allows creating a new Company or joining an existing one via invitation (v2: creation only).
- Creating a Company automatically grants the creator the `OWNER` role.

### 3.2 Dev Bootstrap Policy (DEV ONLY)
- To accelerate development, the system MAY auto-provision a default Company for first-time developers.
- **GATE:** Must be explicitly enabled via `STRUXIENT_DEV_AUTO_PROVISION=true` AND `NODE_ENV=development`.
- **FORBIDDEN:** Auto-provisioning is strictly forbidden in production.
- **IMPLEMENTATION:** If enabled, `getActorTenantContext()` creates a "Dev Company" if none exists for the user.

---

## 4. API Response Contract

### 4.1 No Membership Error
When an actor has no company membership:
- **HTTP Status:** 403
- **Payload:**
```json
{
  "error": {
    "code": "NO_MEMBERSHIP",
    "message": "User has no company membership"
  },
  "timestamp": "ISO-8601"
}
```

---

## 5. UI Requirements

### 5.1 Onboarding State
- UI components (like FlowSpec Builder) MUST detect the `NO_MEMBERSHIP` error code.
- Instead of showing a broken or empty state, they MUST show an "Onboarding Required" view.
- This view MUST provide a clear path (CTA) to create a company.

---

## 6. CI Guards

| Guard | Requirement |
|-------|-------------|
| `guard_dev_provision_gate.mjs` | Verify that auto-provisioning logic is gated by `NODE_ENV !== 'production'`. |
| `tests/api/tenancy/membership.test.ts` | Verify that unaffiliated requests return `NO_MEMBERSHIP`. |
