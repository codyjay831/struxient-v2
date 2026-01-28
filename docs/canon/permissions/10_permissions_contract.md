# Permissions Contract

**Status:** LOCKED  
**Version:** 1.0  
**Last Updated:** 2026-01-28

---

## 1. Canonical Statement

> **Struxient uses a minimal capability-based system to control visibility of sensitive data classes. Capabilities are enforced by data shaping at the API layer. This is NOT RBAC, NOT a role system, and NOT a permission matrix.**

This statement is the canonical lock. All implementations MUST align with this boundary.

---

## 2. Goals

| # | Goal | Description |
|---|------|-------------|
| 2.1 | Protect internal financials | Hide cost data from users who should not see it |
| 2.2 | Domain-agnostic enforcement | Same capability works across Sales, Finance, Jobs, etc. |
| 2.3 | Stable response shapes | Consumers can rely on consistent API response structure |
| 2.4 | Survival across refactors | System works regardless of route changes, file moves, or new domains |
| 2.5 | Minimal surface area | One helper, one filter, one evaluation order |

---

## 3. Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Full RBAC implementation | Complexity exceeds current needs; capabilities are sufficient |
| 3.2 | Per-route permission checks | Creates tight coupling to product structure |
| 3.3 | Per-resource ACLs | Not needed for data-class visibility control |
| 3.4 | UI-authoritative gating | UI may hide elements but API is the enforcer |
| 3.5 | Permission inheritance hierarchies | Adds complexity without value |
| 3.6 | Audit logging of permission checks | Out of scope for v1 |

---

## 4. Capability Evaluation Order

When checking if a user has a capability:

```
1. Member deny    → false (deny always wins)
2. Member allow   → true  (override grants access)
3. Role default   → true/false (baseline for role)
4. No rule exists → false (deny by default)
```

This order is **immutable**. Implementations MUST NOT deviate.

---

## 5. Data Shaping Rules

When a user lacks a capability that protects a data class:

| Rule | Description |
|------|-------------|
| Fields are nulled | Cost-class fields become `null`, not removed |
| Shape is stable | All keys remain present in the response |
| Recursion applies | Nested objects and arrays are traversed |
| Primitives pass through | Non-object data is returned unchanged |
| No 403 unless cost-only | API only blocks if entire surface is protected data |

---

## 6. Integration Points

### 6.1 API Response Building

Every API route that returns cost data MUST call `omitCostFields(data, ctx)` before responding.

```typescript
import { buildAuthorityContext, omitCostFields } from "@/lib/auth/capabilities";

// In route handler:
const member = await getMemberForRequest(request);
const ctx = buildAuthorityContext(member);
const response = omitCostFields(data, ctx);
return NextResponse.json(response);
```

### 6.2 Authority Context Construction

Authority context MUST be built from the authenticated user's `CompanyMember` record:

```typescript
const ctx = buildAuthorityContext({
  role: member.role,
  capabilities: member.capabilities,
});
```

### 6.3 Adding New Capabilities

To add a new capability:

1. Add to `ROLE_DEFAULTS` in `src/lib/auth/capabilities.ts`
2. Document in `00_permissions_glossary.md`
3. Create corresponding field filter if needed (like `omitCostFields`)

---

## 7. What This System Does NOT Do

| Responsibility | Owner |
|----------------|-------|
| User authentication | Clerk |
| Session management | Clerk |
| Route protection | Clerk middleware |
| Workflow authorization | FlowSpec (determines who can act on tasks) |
| Data-class visibility | **This system** |

---

## 8. File Locations

| Component | Path |
|-----------|------|
| Capability check | `src/lib/auth/capabilities.ts` → `hasCapability()` |
| Cost field filter | `src/lib/auth/capabilities.ts` → `omitCostFields()` |
| Authority builder | `src/lib/auth/capabilities.ts` → `buildAuthorityContext()` |
| Schema | `prisma/schema.prisma` → `CompanyMember.capabilities` |
| Tests | `tests/lib/auth/capabilities.test.ts` |
