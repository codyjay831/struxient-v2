# Permissions Invariants

**Status:** LOCKED  
**Version:** 1.0  
**Last Updated:** 2026-01-28

---

## Purpose

This document defines the invariants that MUST hold for the capability-based permission system. Violations of these invariants indicate bugs or architectural drift.

---

## Invariants

### PERM-INV-001: Deny Always Wins

**Statement:**  
If a capability appears in both `member.capabilities.allow` and `member.capabilities.deny`, the result MUST be denial.

**Rationale:**  
Security defaults to closed. Ambiguity resolves to restriction.

**Violation Example:**  
A user has `{ allow: ["view_cost"], deny: ["view_cost"] }` and `hasCapability` returns `true`.

**Detection:**  
Unit test covers this case explicitly.

---

### PERM-INV-002: Response Shape Stability

**Statement:**  
`omitCostFields` MUST preserve all keys in the response object. Cost-class fields are set to `null`, never removed.

**Rationale:**  
Consumers rely on consistent response shapes. Removing keys breaks type safety and client code.

**Violation Example:**  
An API returns `{ id, description, quantity }` for workers but `{ id, description, quantity, cost, margin }` for admins.

**Detection:**  
Test that `Object.keys(result)` equals `Object.keys(original)` after filtering.

---

### PERM-INV-003: No Domain-Specific Permission Logic

**Statement:**  
Permission checks MUST NOT contain domain-specific logic. There MUST be exactly ONE implementation of `hasCapability` used by all domains.

**Rationale:**  
Domain-specific permission logic creates drift, duplication, and inconsistent enforcement.

**Violation Example:**  
Sales module has `salesHasCapability()` that checks additional conditions beyond the standard `hasCapability()`.

**Detection:**  
Code search for alternative capability check implementations.

---

### PERM-INV-004: API Is Authoritative

**Statement:**  
Permission enforcement MUST occur at the API layer via data shaping. UI-only enforcement is insufficient.

**Rationale:**  
Attackers can bypass UI. Only API enforcement provides security.

**Violation Example:**  
Cost data is hidden in the UI but the API returns full cost fields because no `omitCostFields` call exists.

**Detection:**  
API integration tests that verify cost fields are null for workers.

---

### PERM-INV-005: Cost Data Independence from Execution Truth

**Statement:**  
Cost-class fields MUST NOT include data required for task execution. If hiding a field would change what work is done, it is NOT a cost field.

**Rationale:**  
Workers need execution data to perform their jobs. Cost visibility is about financials, not operations.

**Violation Example:**  
`quantity` is added to `COST_CLASS_FIELDS`, breaking worker ability to see how many units to install.

**Detection:**  
Review `COST_CLASS_FIELDS` set for execution-relevant data.

---

### PERM-INV-006: Role Defaults Are Immutable at Runtime

**Statement:**  
`ROLE_DEFAULTS` MUST NOT be modified at runtime. Changes require code deployment.

**Rationale:**  
Role defaults are policy decisions that affect all tenants. Runtime modification would allow privilege escalation.

**Violation Example:**  
An admin API endpoint allows changing what capabilities WORKER role has by default.

**Detection:**  
`ROLE_DEFAULTS` is a const, not configurable via database or API.

---

### PERM-INV-007: Member Overrides Are Scoped to Single Member

**Statement:**  
`CompanyMember.capabilities` affects only that member. There MUST NOT be company-wide or role-wide override storage.

**Rationale:**  
Keeps the model simple. Company-wide policy is expressed via role defaults. Member-specific exceptions are explicit.

**Violation Example:**  
A `Company.defaultCapabilities` field exists that overrides role defaults for all members.

**Detection:**  
Schema review confirms no company-level or role-level capability override fields.

---

### PERM-INV-008: Unknown Capabilities Deny by Default

**Statement:**  
If `hasCapability` is called with a capability name that has no role default, the result MUST be `false`.

**Rationale:**  
Security defaults to closed. New capabilities must be explicitly granted.

**Violation Example:**  
`hasCapability(ctx, "new_feature")` returns `true` because the capability is not in the deny list.

**Detection:**  
Unit test for unknown capability returns `false`.

---

### PERM-INV-009: Capability Names Are Semantic

**Statement:**  
Capability names MUST describe what is protected (e.g., `view_cost`), not where or how (e.g., `access_sales_margin_column`).

**Rationale:**  
Semantic names survive refactors. Structural names create tight coupling.

**Violation Example:**  
Capability named `sales_module_cost_tab` or `api_quotes_margin_field`.

**Detection:**  
Review capability names for route, module, or structural references.

---

### PERM-INV-010: Single Source of Truth for Cost-Class Fields

**Statement:**  
The list of cost-class field names MUST be defined in exactly ONE location: `COST_CLASS_FIELDS` in `src/lib/auth/capabilities.ts`.

**Rationale:**  
Duplication leads to inconsistent enforcement across domains.

**Violation Example:**  
Sales module has its own `SALES_COST_FIELDS` set that differs from the canonical list.

**Detection:**  
Code search for alternative cost field definitions.

---

## Summary Table

| ID | Invariant | Severity |
|----|-----------|----------|
| PERM-INV-001 | Deny always wins | Critical |
| PERM-INV-002 | Response shape stability | High |
| PERM-INV-003 | No domain-specific logic | Critical |
| PERM-INV-004 | API is authoritative | Critical |
| PERM-INV-005 | Cost ≠ execution truth | Critical |
| PERM-INV-006 | Role defaults immutable | High |
| PERM-INV-007 | Overrides scoped to member | Medium |
| PERM-INV-008 | Unknown capabilities deny | High |
| PERM-INV-009 | Semantic capability names | Medium |
| PERM-INV-010 | Single source for cost fields | High |
