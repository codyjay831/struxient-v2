# Permissions Glossary

**Status:** LOCKED  
**Version:** 1.0  
**Last Updated:** 2026-01-28

---

## Purpose

This glossary defines the authoritative meaning of terms used in Struxient's capability-based permission system. All implementations MUST align with these definitions.

---

## Terms

### Capability

A named permission that controls access to a specific class of data or action.

**Characteristics:**
- Capabilities are semantic, not structural (they describe *what* is protected, not *where*)
- Capabilities are domain-agnostic (same capability works across all domains)
- Capabilities do not enumerate routes, modules, or products

**Current Capabilities:**
| Name | Description |
|------|-------------|
| `view_cost` | Controls visibility of internal cost data |

---

### Cost Data (Cost-Class Fields)

Data that exposes internal company financials.

**Includes:**
- Cost basis (`cost`, `costBasis`, `internalCost`, `unitCost`)
- Margin/markup (`margin`, `markup`, `marginPercent`, `markupPercent`)
- Profit (`profit`, `grossProfit`, `netProfit`, `profitMargin`)
- Internal totals (`internalTotal`, `internalSubtotal`, `costTotal`)

**Explicitly Does NOT Include:**
- Quantities
- Specs or scope descriptions
- Execution requirements
- Customer-agreed totals required to perform work
- Anything FlowSpec or task execution depends on

**Rule:** If hiding a value would change *what work is done*, it is NOT cost data.

---

### Authority Context

The minimum information needed to evaluate capabilities for a user.

**Contains:**
- `role`: The user's role within the company (OWNER, ADMIN, MANAGER, WORKER)
- `capabilities`: Member-level overrides (`{ allow: string[], deny: string[] }`)

---

### Role Defaults

The baseline capability grants for each role. Member overrides can allow or deny capabilities beyond these defaults.

| Role | `view_cost` |
|------|-------------|
| OWNER | allow |
| ADMIN | allow |
| MANAGER | allow |
| WORKER | deny |

---

### Member Override

A per-member capability grant or denial that modifies role defaults.

**Stored as:** `CompanyMember.capabilities` JSON field  
**Schema:** `{ allow: string[], deny: string[] }`

**Evaluation Rule:** Deny always wins.

---

### Data Shaping

The enforcement model where permissions are applied by modifying response data, not by blocking access.

**Characteristics:**
- Fields are nulled, not removed (response shape is stable)
- API does not return 403 unless the entire surface is cost-only
- UI may hide elements, but UI is never authoritative

---

## Non-Terms (What This System Is NOT)

| Term | Why It Does Not Apply |
|------|----------------------|
| RBAC | This is capability-based, not role-based access control |
| Permission Matrix | Capabilities are semantic, not route/resource enumeration |
| ACL | No per-resource access control lists exist |
| Scope | Capabilities are not OAuth-style scopes |
