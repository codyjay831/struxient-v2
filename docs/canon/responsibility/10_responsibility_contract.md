# Responsibility Layer v2.1 — Contract

## 1. Accountability vs. Authority
The Responsibility Layer attributes accountability (who is expected to do the work) without granting authority (who is permitted to do the work). Responsibility slots are advisory metadata and never gate execution.

## 2. Job Assignment Model
- **Slot-Based:** Assignments are made to "Slots" (e.g., `PM`, `SALES_LEAD`) on a specific `Job`.
- **Assignee Types:**
    - **PERSON:** A `CompanyMember` (Internal).
    - **EXTERNAL:** An `ExternalParty` record (Vendor/Sub).

- **Current Assignment Invariant:**  
  At any given time, a slot may have zero or one *current* assignment.  
  The current assignment is the record where `supersededAt IS NULL`.

- **Exactly-One-Of Invariant (Storage):**  
  Each assignment record must reference exactly one assignee:
  - If `assigneeType = PERSON`, `memberId` is set and `externalPartyId` is NULL.
  - If `assigneeType = EXTERNAL`, `externalPartyId` is set and `memberId` is NULL.

## 3. Storage Semantics (Append-Only)
- **Supersession:** Assignments are never deleted or updated in-place.
- **Current State:** The "Current" assignment for a slot is the record where `supersededAt` is NULL.
- **Evidence:** `prisma/schema.prisma` Line 154.

## 4. Identity Projection
- **Minimal Pointers:** Actionable task payloads are enriched with minimal pointers (id, name) to prevent identity leakage.
- **Enforcement:** `tests/lib/responsibility/actionable_purity.test.ts`
- **Evidence:** `src/app/api/flowspec/actionable-tasks/route.ts` Lines 85-87.
