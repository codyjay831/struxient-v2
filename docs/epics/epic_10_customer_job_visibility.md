# epic_10_customer_job_visibility.md

**Epic ID:** EPIC-10  
**Title:** Customer & Job Visibility (The Projection Layer)  
**Status:** PLANNING  
**Canon Sources:** 00_jobs_glossary.md, 00_flowspec_glossary.md (§3.6)

---

## 1. Purpose / Problem Statement

While the **Truth Store** (FlowSpec) and **Execution Surface** (Work Station) are defined, the system lacks formal planning for the **Projection Layer**. Humans need a way to navigate from a Customer relationship to a specific Job and view a projected timeline of what FlowSpec has recorded. This epic bridges the gap between metadata (Jobs/Customers) and Truth (FlowSpec).

---

## 2. Execution Phases

### Phase 1: Projection Read Models (Define Once)
1. **Customer → Jobs Projection**: Aggregate metadata and link to Job list. Derived high-level status (Signals) only.
2. **Job Card Metadata Projection**: Identity and context only (Who/Where/When).
3. **Job Card Execution Timeline**: Chronological log of recorded Outcomes and Evidence from FlowSpec.

### Phase 2: Read-Only Query Wiring
- Customer → Jobs relationship wiring.
- Job → FlowGroup linkage.
- FlowGroup → Execution Timeline aggregation.
- **Rule**: Any cache MUST be reconstructible entirely from FlowSpec Truth.

### Phase 3: Job Creation & Binding (Hard Enforcement)
**Mandatory Sequence**:
1. Create Customer record.
2. Select Workflow.
3. Instantiate FlowGroup (creating Scope).
4. Create Job record and bind `flowGroupId`.
- **Constraint**: 1:1 relationship between Job and FlowGroup enforced.

### Phase 4: Navigation Wiring
- Customer → Job Card (Projection).
- Job Card → Work Station (Execution).
- **Forbidden**: Action UI or state-change controls on the Job Card.

### Phase 5: Drift Guards & Tests
- **Guard**: Prevent addition of `status`, `stage`, or `currentNode` columns to the Job table.
- **Test**: Reconstruction Test — verify Job Card can be rebuilt from zero cache using only FlowSpec Truth.

---

## 3. In Scope (Planning Only)

- Mapping Customer records to Job records.
- Linking Job records to FlowGroup execution instances (via `scope`).
- Defining the requirement for **Job Cards** to query and aggregate FlowSpec Truth for historical lookup.
- Defining the sequence for instantiating a FlowSpec Flow Group and then binding it to a new Job record.

---

## 3. Out of Scope

- Implementation of the UI for Job Cards or Customer lists.
- Changes to how FlowSpec stores truth.
- Creating "Task App" features (comments, manual status, etc.) inside the Job record.

---

## 4. Dependencies

- **Jobs Canon:** Definition of Job vs. Job Card (`00_jobs_glossary.md`).
- **EPIC-03:** Flow Instantiation (to provide the FlowGroup linkage).
- **EPIC-07:** Builder API (to ensure Workflows are available for Job-linked flows).

---

## 5. Non-Goals

- **No Truth Ownership Changes:** Jobs never become the source of truth for execution.
- **No Manual Advancement:** Job Cards do not "move" jobs; they only display where FlowSpec says they are.

---

## 6. Acceptance Criteria (Planning Level)

- [ ] A clear path is defined for creating a Job under a Customer and linking it to a FlowGroup.
- [ ] Requirements for the Job Card to act as a read-only **Projection Surface** are established.
- [ ] The distinction between metadata (Job name, address) and Truth (Task outcomes, Evidence) is maintained.
- [ ] Navigation flows from Customer → Job → FlowGroup are logically mapped.

---

## 7. Implementation Constraints (EPIC-10)

- **Derived Signals**: Any derived state (ACTIVE, COMPLETED, BLOCKED, etc.) displayed on projection surfaces must be computed from FlowSpec-owned status at request time.
- **GET-Only Routes**: API routes for EPIC-10 projections are GET-only by contract to ensure side-effect-free reconstruction.
- **Deterministic Ledgers**: All timeline projections must use deterministic sorting (timestamp → typeOrder → recordId).

---

**End of Document**
