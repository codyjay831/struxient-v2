# Unused Export Deprecations (2026-02-04)

The following symbols have been marked as `@deprecated unused` based on a `knip` audit. These symbols were confirmed to have zero external references across the source code, tests, canonical documentation, and CI guards.

| File | Line | Symbol | Why Safe | Removal Target |
|---|---|---|---|---|
| `src/lib/flowspec/engine.ts` | 68 | `recordValidityEvent` | Only used internally in `engine.ts` | Batch 6 |
| `src/lib/flowspec/truth.ts` | 282 | `getTaskExecutionHistory` | Zero references | Batch 6 |
| `src/lib/flowspec/truth.ts` | 392 | `getFlowEvidence` | Zero references | Batch 6 |
| `src/lib/flowspec/types.ts` | 520 | `isTerminalGate` | Zero references | Batch 6 |
| `src/lib/flowspec/persistence/workflow.ts` | 121 | `createWorkflowFromTemplate` | Referenced only in Guard logs | Batch 6 |
| `src/lib/flowspec/derived.ts` | 745 | `explainActionRefusal` | Zero references | Batch 6 |
| `src/lib/flowspec/derived.ts` | 845 | `getGateRoute` | Zero references | Batch 6 |
| `src/lib/flowspec/policy.ts` | 71 | `findTaskInSnapshotById` | Zero references | Batch 6 |
| `src/lib/auth/tenant.ts` | 16 | `TenantIsolationError` | Only thrown internally in `tenant.ts` | Batch 6 |
| `src/lib/auth/tenant.ts` | 121 | `getActorCompanyId` | Referenced only in Guard config | Batch 6 |
| `src/lib/storage/index.ts` | 7 | `generateStorageKey` | Barrel export of unused S3 function | Batch 6 |
| `src/lib/storage/index.ts` | 8 | `extractCompanyIdFromKey` | Barrel export of unused S3 function | Batch 6 |
| `src/lib/storage/index.ts` | 9 | `validateStorageKeyOwnership` | Barrel export of unused S3 function | Batch 6 |
| `src/lib/storage/index.ts` | 10 | `validateFilePointer` | Barrel export of unused S3 function | Batch 6 |
| `src/lib/storage/index.ts` | 11 | `checkFileExists` | Barrel export of unused S3 function | Batch 6 |
| `src/lib/modules/moduleFlags.ts` | 65 | `getEnabledModules` | Zero references | Batch 6 |
| `src/lib/nav/appNav.ts` | 98 | `getAllNavItems` | Zero references | Batch 6 |
| `src/lib/nav/appNav.ts` | 105 | `isRouteModuleEnabled` | Zero references | Batch 6 |
