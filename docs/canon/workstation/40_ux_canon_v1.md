# UX Canon v1.0

**Document ID:** 40_ux_canon_v1  
**Status:** CANONICAL  
**Last Updated:** 2026-01-31

---

## 1. Surface Roles and Permissions

This section defines the canonical roles of product surfaces and the mutations permitted on each.

| Surface | Role | Allowed Mutations | Forbidden Mutations | Evidence (Code) |
| :--- | :--- | :--- | :--- | :--- |
| **Work Station** | Execution Surface | Start Task, Record Outcome, Attach Evidence | Domain metadata edits | `src/app/(app)/workstation/...` |
| **Jobs** | Entry & Recovery | Create FlowGroup (Sales OFF), Link Metadata | Outcome/Evidence recording | `src/app/(app)/jobs/page.tsx` |
| **Sales** | Entry & Lens | Create FlowGroup (Sales ON) | Outcome/Evidence recording | `src/app/(app)/sales/page.tsx` |
| **Finance** | Lens | None (Read-only projection) | All execution/metadata mutations | `src/app/(app)/finance/page.tsx` |
| **Job Card** | Projection | None (Read-only timeline) | All execution/metadata mutations | `src/app/(app)/jobs/[id]/page.tsx` |
| **Customers** | CRM & Projection | Create/Edit Customer | All execution mutations | `src/app/(app)/customers/...` |

---

## 2. Navigation Standards

Consistent query parameters ensure deep-linking and state preservation across the application.

### 2.1 Work Station Filtering
All execution-scoped views (Jobs list, Sales cards, etc.) MUST use the following standard to filter the Work Station:
- **Param**: `?job=<flowGroupId>`
- *Evidence: src/app/(app)/workstation/page.tsx:27*

### 2.2 Admin Recovery Deep-Linking
The "Link Metadata" path for remediating FlowGroups without Jobs uses a dedicated recovery standard:
- **Path**: `/jobs?showAdmin=true&flowGroupId=<id>`
- **Behavior**: Auto-expands "Admin & Recovery" section and pre-selects the FlowGroup.
- *Evidence: src/app/(app)/jobs/page.tsx:70–74*

---

## 3. BLOCKED State Visibility

The `BLOCKED` status is a system-critical signal that requires human intervention.

1. **Read-Only Alert**: `BLOCKED` state MUST be displayed as a prominent banner or status badge.
2. **No Shortcut Unblocking**: Projection and Lens surfaces (Sales, Jobs, Job Card) MUST NOT provide "Retry" or "Unblock" buttons. Unblocking is an admin/recovery action.
- *Evidence: src/app/(app)/workstation/_components/job-header.tsx:100–114*

---

## 4. Lens-Only Integrity

Lenses (Sales Dashboard, Finance Ledger) are strictly observational. 
- They may deep-link to the Work Station for action.
- They MUST NOT contain logic or UI for recording Task outcomes or attaching Evidence.
- *Evidence: src/app/(app)/sales/page.tsx, src/app/(app)/finance/page.tsx (fetch only, no mutation routes called)*

---

**End of Document**
