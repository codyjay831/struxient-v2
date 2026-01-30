# epic_09_permissions_enforcement.md

**Epic ID:** EPIC-09  
**Title:** Permissions Enforcement  
**Status:** SPECIFICATION  
**Canon Sources:** 00_permissions_glossary.md, 10_permissions_contract.md, 20_permissions_invariants.md

---

## 1. Purpose

Implement the capability-based permission system that controls visibility of sensitive data classes (specifically cost data) through data shaping at the API layer. This system ensures that whenever execution Truth is accessed by a **Projection Surface** (like a Job Card or report), sensitive financials are protected based on the actor's capabilities.

---

## 2. In-Scope Responsibilities

- Define and evaluate capabilities (`view_cost`)
- Build Authority Context from authenticated user's CompanyMember record
- Enforce role defaults (OWNER, ADMIN, MANAGER allow; WORKER deny)
- Support member-level overrides (allow/deny)
- Apply data shaping to API responses (null cost fields, preserve shape)
- Maintain single source of truth for cost-class fields
- Ensure domain-agnostic enforcement

---

## 3. Out-of-Scope (Explicit Non-Goals)

| # | Non-Goal | Rationale |
|---|----------|-----------|
| 3.1 | Full RBAC implementation | Complexity exceeds current needs (10_permissions_contract.md §3.1) |
| 3.2 | Per-route permission checks | Creates tight coupling (10_permissions_contract.md §3.2) |
| 3.3 | Per-resource ACLs | Not needed for data-class visibility (10_permissions_contract.md §3.3) |
| 3.4 | UI-authoritative gating | API is the enforcer (10_permissions_contract.md §3.4) |
| 3.5 | Permission inheritance hierarchies | Adds complexity without value (10_permissions_contract.md §3.5) |
| 3.6 | Audit logging of permission checks | Out of scope for v1 (10_permissions_contract.md §3.6) |
| 3.7 | Workflow authorization | FlowSpec determines task authorization (10_permissions_contract.md §7) |

---

## 4. Authoritative Requirements

### 4.1 Capability Definition

- Capability: `view_cost` — controls visibility of internal cost data
  - *Source: 00_permissions_glossary.md, Capability*
- Capabilities are semantic, not structural
  - *Source: 00_permissions_glossary.md, Capability*
- Capabilities are domain-agnostic (same capability works across all domains)
  - *Source: 00_permissions_glossary.md, Capability*

### 4.2 Cost-Class Fields

Cost data includes:
- Cost basis: `cost`, `costBasis`, `internalCost`, `unitCost`
- Margin/markup: `margin`, `markup`, `marginPercent`, `markupPercent`
- Profit: `profit`, `grossProfit`, `netProfit`, `profitMargin`
- Internal totals: `internalTotal`, `internalSubtotal`, `costTotal`

*Source: 00_permissions_glossary.md, Cost Data*

Cost data explicitly does NOT include:
- Quantities
- Specs or scope descriptions
- Execution requirements
- Customer-agreed totals required to perform work
- Anything FlowSpec or task execution depends on

*Source: 00_permissions_glossary.md, Cost Data*

**Rule:** If hiding a value would change what work is done, it is NOT cost data.
*Source: 00_permissions_glossary.md, Cost Data*

### 4.3 Role Defaults

| Role | `view_cost` |
|------|-------------|
| OWNER | allow |
| ADMIN | allow |
| MANAGER | allow |
| WORKER | deny |

*Source: 00_permissions_glossary.md, Role Defaults*

### 4.4 Member Override

- Stored as `CompanyMember.capabilities` JSON field
- Schema: `{ allow: string[], deny: string[] }`
- Evaluation Rule: **Deny always wins**

*Source: 00_permissions_glossary.md, Member Override*

### 4.5 Capability Evaluation Order

```
1. Member deny    → false (deny always wins)
2. Member allow   → true  (override grants access)
3. Role default   → true/false (baseline for role)
4. No rule exists → false (deny by default)
```

This order is **immutable**. Implementations MUST NOT deviate.

*Source: 10_permissions_contract.md §4*

### 4.6 Data Shaping Rules

- Fields are nulled, not removed
  - *Source: 10_permissions_contract.md §5*
- Shape is stable (all keys remain present)
  - *Source: 10_permissions_contract.md §5*
- Recursion applies (nested objects and arrays traversed)
  - *Source: 10_permissions_contract.md §5*
- Primitives pass through unchanged
  - *Source: 10_permissions_contract.md §5*
- No 403 unless entire surface is protected data
  - *Source: 10_permissions_contract.md §5*

### 4.7 Integration Points

Every API route that returns cost data **MUST** call `omitCostFields(data, ctx)` before responding.

*Source: 10_permissions_contract.md §6.1*

Authority context **MUST** be built from authenticated user's CompanyMember record:

```typescript
const ctx = buildAuthorityContext({
  role: member.role,
  capabilities: member.capabilities,
});
```

*Source: 10_permissions_contract.md §6.2*

---

## 5. System Boundaries & Ownership

| Owned by Permissions System | Delegated to Other Systems |
|----------------------------|---------------------------|
| Capability evaluation | User authentication (Clerk) |
| Data shaping (cost field filtering) | Session management (Clerk) |
| Role default definitions | Route protection (Clerk middleware) |
| Member override application | Workflow authorization (FlowSpec) |
| Cost-class field list | |

---

## 6. Edge Cases & Failure Modes

### 6.1 Member Has Both Allow and Deny for Same Capability

**Scenario:** `member.capabilities = { allow: ["view_cost"], deny: ["view_cost"] }`

**Required Behavior:**
- Result is denial (deny always wins)
- `hasCapability(ctx, "view_cost")` returns `false`

*Source: 20_permissions_invariants.md PERM-INV-001*

### 6.2 Unknown Capability Requested

**Scenario:** `hasCapability(ctx, "new_feature")` where `new_feature` has no role default.

**Required Behavior:**
- Result is `false` (deny by default)
- No error thrown

*Source: 20_permissions_invariants.md PERM-INV-008*

### 6.3 Nested Cost Data in Response

**Scenario:** API returns `{ job: { items: [{ name: "...", cost: 100 }] } }`

**Required Behavior:**
- Recursion applies
- Result: `{ job: { items: [{ name: "...", cost: null }] } }`
- All keys preserved

### 6.4 Response Contains Only Cost Data

**Scenario:** API endpoint returns only cost-class fields (e.g., profit report).

**Required Behavior:**
- Option A: Return 403 (entire surface is protected)
- Option B: Return with all values nulled (shape preserved)
- Prefer Option B unless endpoint is explicitly cost-only

*Source: 10_permissions_contract.md §5*

### 6.5 Worker Needs Quantity But Not Cost

**Scenario:** Worker must see quantity to do work, but cost is hidden.

**Required Behavior:**
- `quantity` is NOT a cost-class field
- Worker sees full quantity
- Cost-class fields (cost, margin, etc.) are nulled

*Source: 20_permissions_invariants.md PERM-INV-005*

---

## 7. Invariants Enforced

| ID | Invariant | Description |
|----|-----------|-------------|
| PERM-INV-001 | Deny Always Wins | Deny overrides allow |
| PERM-INV-002 | Response Shape Stability | Keys preserved, values nulled |
| PERM-INV-003 | No Domain-Specific Logic | Single `hasCapability` implementation |
| PERM-INV-004 | API Is Authoritative | API layer enforces, not UI |
| PERM-INV-005 | Cost ≠ Execution Truth | Cost fields don't include execution data |
| PERM-INV-006 | Role Defaults Immutable | No runtime modification |
| PERM-INV-007 | Overrides Scoped to Member | Per-member only, no company-wide |
| PERM-INV-008 | Unknown Capabilities Deny | Default is false |
| PERM-INV-009 | Semantic Capability Names | Describe what, not where |
| PERM-INV-010 | Single Source for Cost Fields | One `COST_CLASS_FIELDS` definition |

---

## 8. Implementation Notes

### 8.1 File Locations

| Component | Path |
|-----------|------|
| Capability check | `src/lib/auth/capabilities.ts` → `hasCapability()` |
| Cost field filter | `src/lib/auth/capabilities.ts` → `omitCostFields()` |
| Authority builder | `src/lib/auth/capabilities.ts` → `buildAuthorityContext()` |
| Schema | `prisma/schema.prisma` → `CompanyMember.capabilities` |
| Tests | `tests/lib/auth/capabilities.test.ts` |

*Source: 10_permissions_contract.md §8*

### 8.2 Authority Context Shape

```typescript
interface AuthorityContext {
  role: "OWNER" | "ADMIN" | "MANAGER" | "WORKER";
  capabilities: {
    allow: string[];
    deny: string[];
  };
}
```

*Source: 00_permissions_glossary.md, Authority Context*

### 8.3 hasCapability Implementation

```typescript
function hasCapability(ctx: AuthorityContext, capability: string): boolean {
  // 1. Member deny → false
  if (ctx.capabilities.deny.includes(capability)) {
    return false;
  }
  
  // 2. Member allow → true
  if (ctx.capabilities.allow.includes(capability)) {
    return true;
  }
  
  // 3. Role default
  const roleDefault = ROLE_DEFAULTS[ctx.role]?.[capability];
  if (roleDefault !== undefined) {
    return roleDefault;
  }
  
  // 4. No rule → false
  return false;
}
```

### 8.4 omitCostFields Implementation Pattern

```typescript
function omitCostFields(data: any, ctx: AuthorityContext): any {
  if (hasCapability(ctx, "view_cost")) {
    return data; // Pass through unchanged
  }
  
  return recursivelyNullCostFields(data, COST_CLASS_FIELDS);
}
```

### 8.5 COST_CLASS_FIELDS Set

```typescript
const COST_CLASS_FIELDS = new Set([
  "cost",
  "costBasis",
  "internalCost",
  "unitCost",
  "margin",
  "markup",
  "marginPercent",
  "markupPercent",
  "profit",
  "grossProfit",
  "netProfit",
  "profitMargin",
  "internalTotal",
  "internalSubtotal",
  "costTotal",
]);
```

### 8.6 Adding New Capabilities

To add a new capability:
1. Add to `ROLE_DEFAULTS` in `src/lib/auth/capabilities.ts`
2. Document in `00_permissions_glossary.md`
3. Create corresponding field filter if needed

*Source: 10_permissions_contract.md §6.3*

---

## 9. Acceptance Criteria

- [ ] `hasCapability` returns correct result for role defaults
- [ ] `hasCapability` respects member allow overrides
- [ ] `hasCapability` respects member deny overrides
- [ ] Deny wins when both allow and deny are present
- [ ] Unknown capabilities return false
- [ ] `omitCostFields` nulls cost-class fields for users without `view_cost`
- [ ] `omitCostFields` preserves all keys (shape stability)
- [ ] `omitCostFields` applies recursively to nested objects
- [ ] `omitCostFields` applies to arrays
- [ ] `omitCostFields` passes data unchanged for users with `view_cost`
- [ ] Non-cost fields (e.g., quantity) are not affected
- [ ] COST_CLASS_FIELDS is the single source of truth
- [ ] No domain-specific permission logic exists
- [ ] All API routes returning cost data call `omitCostFields`
- [ ] ROLE_DEFAULTS cannot be modified at runtime
- [ ] Member overrides are scoped to single member only

---

## 10. Open Questions

None — canon complete.
