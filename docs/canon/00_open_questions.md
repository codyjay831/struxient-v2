# Open Questions / Deferred Decisions

This document records architectural decisions that have been intentionally deferred. These are known "open questions" where multiple paths exist but a final choice is not yet required for the current milestone.

---

## 1. Manual Progression / Admin Override Policy — OPEN

**Status:** Not decided (intentional)

**Summary:** 
End users cannot bypass evidence requirements or manually advance workflows; this is strictly enforced at the application/engine level. However, the system currently lacks a formal policy or mechanism for administrative overrides.

**Note:** 
Admins or internal maintenance scripts may technically bypass these gates by interacting with the persistence layer (Truth) directly. This is currently viewed as a governance and internal access control issue, rather than a user-facing feature or abuse path.

**Options (Not Chosen):**
1. **Audited Overrides:** Allow administrators to bypass gates through a dedicated UI/API, but require a justification and record it in a permanent audit log.
2. **Hard Blocking:** Forbid all overrides mechanically, even for system administrators. Any "stuck" workflow must be fixed by updating the specification or correcting the data.
3. **Silent Overrides (Current State):** Maintain the current trust-based model where direct database access is required for overrides, with no dedicated application-level support.

**“Decision deferred until” triggers:**
- Onboarding of external multi-tenant customers (requiring formal SLA/Governance).
- Regulatory compliance or audit requirements (e.g., SOC2) necessitate formal bypass controls.
- An emergency recovery workflow is defined and requires standardized intervention.
