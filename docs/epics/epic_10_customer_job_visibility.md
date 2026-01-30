# epic_10_customer_job_visibility.md

**Epic ID:** EPIC-10  
**Title:** Customer & Job Visibility (The Projection Layer)  
**Status:** PLANNING  
**Canon Sources:** 00_jobs_glossary.md, 00_flowspec_glossary.md (§3.6)

---

## 1. Purpose / Problem Statement

While the **Truth Store** (FlowSpec) and **Execution Surface** (Work Station) are defined, the system lacks formal planning for the **Projection Layer**. Humans need a way to navigate from a Customer relationship to a specific Job and view a projected timeline of what FlowSpec has recorded. This epic bridges the gap between metadata (Jobs/Customers) and Truth (FlowSpec).

---

## 2. In Scope (Planning Only)

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

**End of Document**
