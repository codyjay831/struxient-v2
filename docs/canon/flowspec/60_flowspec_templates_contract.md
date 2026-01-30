# FlowSpec Templates Contract

**Document ID:** 60_flowspec_templates_contract  
**Status:** CANONICAL  
**Last Updated:** 2026-01-29  
**Related Documents:**
- [00_flowspec_glossary.md](./00_flowspec_glossary.md)
- [10_flowspec_engine_contract.md](./10_flowspec_engine_contract.md)
- [20_flowspec_invariants.md](./20_flowspec_invariants.md)

---

## 1. Purpose

This document defines the behavioral contract for Workflow Templates and the Snapshot Library. Templates provide a mechanism for creating standardized workflows across multiple tenants.

---

## 2. Definitions

### 2.1 Workflow Template
A system-global, non-executing specification stored in the `WorkflowTemplate` table.

### 2.2 Snapshot Library
The collection of all available `WorkflowTemplate` versions.

### 2.3 Template Import
The process of cloning a Template's definition into a tenant-owned Workflow.

---

## 3. Core Constraints

### 3.1 Non-Executing Blueprints
1. Templates are data only. They MUST NOT contain runtime state (Flows, Executions).
2. The FlowSpec Engine MUST NOT read from the `WorkflowTemplate` table during execution.
3. Templates exist outside the tenant (Company) hierarchy.

### 3.2 Immutability & Versioning
1. `WorkflowTemplate` records are immutable.
2. Updates MUST be performed by inserting a new row with an incremented `version` field.
3. Patching existing template rows is PROHIBITED.

### 3.3 Import Mechanics
1. **Source:** `WorkflowTemplate.definition` contains a `WorkflowSnapshot` JSON object.
2. **Result:** Import creates a new `Workflow` record in `DRAFT` status belonging to the importing Company.
3. **ID Isolation:** All internal IDs (Nodes, Tasks, Outcomes, Gates) MUST be regenerated during import.
4. **Provenance:** The new Workflow MUST record `templateId` and `templateVersion`. These fields are Write-Once.

---

## 4. Invariants

- **INV-027:** Template Library Immutability (No in-place updates).
- **INV-028:** Provenance is Write-Once.
- **Structural Alignment:** `Template.definition` MUST pass the same validation rules as a `WorkflowVersion.snapshot`.

---

## 5. Persistence Boundary

### 5.1 Gateway Enforcement
All mutations to Workflow structure (Drafts) and Templates MUST go through the central persistence gateway.

### 5.2 CI Guards

1. `guard_flowspec_persistence_boundary.mjs`: Enforces that raw Prisma writes to `Workflow`, `Node`, `Task`, `Outcome`, and `Gate` tables are prohibited outside the authorized persistence modules.
2. `guard_flowspec_schema_constraints.mjs`: Enforces Prisma and structural schema invariants for stored snapshots.
3. `guard_flowspec_template_schema.mjs`: Validates template definitions stored in `src/lib/flowspec/templates/definitions/*.json`. This guard executes `tests/compliance/template_schema.test.ts`, ensuring that both runtime import and CI use `parseTemplateDefinition` as the single source of truth.

---

## 6. Non-Goals

- Templates do NOT automatically update existing Flows or Workflows.
- Templates do NOT belong to tenants.
- Templates are NOT executable.

---

**End of Document**
