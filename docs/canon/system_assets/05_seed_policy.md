# Seed Data Policy

## System Assets
* **System Library templates** (WorkflowTemplates) are considered "product assets" and are allowed to exist globally (no `companyId`).
* These assets may be bootstrapped/seeded by default during deployment.
* System templates must be immutable and versioned.

## Fixtures & Demo Data
* **Fixtures and demo templates** MUST NOT be seeded by default.
* Fixture seeding is strictly opt-in via `STRUXIENT_SEED_FIXTURES=true`.
* **Promoted Assets:** Templates like "Solar Residential - Detour Demonstration" and "Permit → Install → Inspect (Corrections Loops)" are now promoted to System Library and are NOT fixtures.
* Fixture seeding is **STRICTLY FORBIDDEN** in production environments.
* The application must remain functional with zero domain data (empty table tolerance).
