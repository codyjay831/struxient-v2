# Jobs Glossary

**Document ID:** 00_jobs_glossary  
**Status:** CANONICAL  
**Last Updated:** 2026-01-30  
**Related Documents:**
- [FlowSpec Glossary](../flowspec/00_flowspec_glossary.md)
- [FlowSpec Engine Contract](../flowspec/10_flowspec_engine_contract.md)
- [Work Station Contract](../workstation/10_workstation_contract.md)

---

## 1. Purpose

This document defines terms specific to the Jobs domain. For FlowSpec-related 
terms (Flow, Flow Group, Task, Outcome, etc.), see 
[FlowSpec Glossary](../flowspec/00_flowspec_glossary.md).

---

## 2. Core Definitions

### 2.1 Job

**Definition:** A Job is a tenant-owned metadata record that links a Customer 
to a Flow Group. Jobs provide a human-friendly lookup surface for viewing 
execution history.

**Clarification:**
- Job is a **Projection Surface**, not a Truth Store.
- Job does NOT store execution state, outcomes, or evidence.
- Job references a Flow Group; execution Truth lives in FlowSpec tables.
- The term "Job Card" refers to the UI detail view of a Job record.

**Relationship:**
- A Job belongs to exactly one Customer.
- A Job references exactly one Flow Group.
- A Flow Group may be referenced by at most one Job (1:1).

**What a Job IS:**
- Metadata linking Customer to Flow Group
- A navigation artifact for human lookup
- A Projection Surface aggregating FlowSpec Truth for display

**What a Job is NOT:**
- A Truth Store
- A container for execution state
- A source of workflow data

---

### 2.2 Job Card

**Definition:** Job Card is the UI/UX term for the detail view of a Job record.

**Clarification:**
- Job Card displays Job metadata and projects FlowSpec Truth.
- Job Card is where humans look up history and status.
- Job Card does NOT own, store, or mutate Truth.
- All execution data displayed on a Job Card is derived from FlowSpec.

**Rule:** If a Job Card displays execution state, that state MUST be queried 
from FlowSpec. The Job Card is a projection, not a source.

---

## 3. Relationship to FlowSpec

| Jobs Concept | FlowSpec Equivalent | Relationship |
|--------------|---------------------|--------------|
| Job | Flow Group | Job references Flow Group via FK |
| Job Card (UI) | Flow Group + Flows | Displays aggregated FlowSpec Truth |
| Customer history | Flow Group history | Aggregates all Flow Groups for Customer |

---

## 4. Glossary Index

| Term | Section |
|------|---------|
| Job | 2.1 |
| Job Card | 2.2 |

---

**End of Document**
