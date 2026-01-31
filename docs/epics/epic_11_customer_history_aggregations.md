# epic_11_customer_history_aggregations.md

**Epic ID:** EPIC-11  
**Title:** Customer History & Aggregations (Relationship Projection)  
**Status:** PLANNING  
**Canon Sources:** 00_flowspec_glossary.md (§3.6), 10_flowspec_engine_contract.md (§9.1)

---

## 1. Purpose
While EPIC-10 provides visibility into individual units of work (Jobs), EPIC-11 provides **Relationship-Level Visibility**. It aggregates FlowSpec Truth across all Jobs owned by a Customer to answer the question: *"What is our complete history with this person/organization?"* 

This epic ensures that historical lookups and cross-job artifact retrieval are handled through deterministic projections rather than CRM-style manual logging.

## 2. Personas Served
- **Business Owners / Managers**: Need to see lifetime engagement history and relationship-level health metrics.
- **Support / Account Managers**: Need to retrieve evidence or outcomes from past jobs to inform current actions.
- **Audit / Compliance Officers**: Need a unified ledger of all truth events associated with a specific entity.

## 3. In-Scope (Read-Only)
- **Customer Lifetime Ledger**: Interleaved chronological stream of FlowSpec truth events from all Jobs linked to the Customer.
- **Customer Evidence Vault**: A centralized projection surface for all artifacts (files, text, data) attached to any Job for the Customer.
- **Relationship Health Signals**: Derived cross-job metrics (e.g., "Last Engagement Outcome," "Recurrence Rate of Blocked Nodes").
- **Search & Filter**: Ability to filter the relationship ledger by Job Type, Workflow, or Date range.

## 4. Explicit Non-Goals (Drift Prevention)
- **NO CRM Features**: No manual notes, no activity feed entries, no "log a call," no "set a reminder."
- **NO Stored Balances/Grades**: No "Customer Grade" or "Status" fields stored on the Customer model.
- **NO Execution UI**: No task completion or outcome submission UI. Use the Work Station for all actions.
- **NO History Mutation**: The ledger is an append-only projection of immutable truth. No "Delete from History" or "Edit Entry."

## 5. Conceptual Projection Models

### Customer Lifetime Ledger
- **Origin**: `Job[]` → `FlowGroup[]` → `NodeActivation[]` + `TaskExecution[]` + `EvidenceAttachment[]`.
- **Interleaving**: Multiple jobs are flattened into a single stream.
- **Constraint**: Must be reconstructible from zero-cache at any time.

### Customer Evidence Vault
- **Origin**: `EvidenceAttachment[]` for all Flows in all Flow Groups linked to the Customer's Jobs.
- **Structure**: Grouped by artifact type or Job anchor.

## 6. Deterministic Ordering Rules
Interleaved history MUST follow a stable sort:
1. `timestamp` (ASC)
2. `typeOrder` (Stable discriminator: Node > Task Start > Evidence > Outcome)
3. `jobId` (Tie-breaker for concurrent events)
4. `recordId` (Final tie-breaker)

## 7. Performance Constraints
- **Projection Indexing**: Materialized views or optimized read-models are permitted for performance.
- **Summary Field Ban**: Writing execution summaries (e.g., `last_job_outcome`) back to the `Customer` table is strictly FORBIDDEN.

## 8. Canon Guardrails
- **Reconstruction Rule**: The Customer History view must be bit-for-bit reproducible from FlowSpec truth tables.
- **GET-Only Enforcement**: All EPIC-11 endpoints must be side-effect free.

## 9. Dependencies
- **EPIC-10**: Job-Customer relationship mapping.
- **FlowSpec Truth Tables**: Authoritative source for all events.

---

**End of Document**
