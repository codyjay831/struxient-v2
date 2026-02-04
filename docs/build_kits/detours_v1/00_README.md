# Detour Build Kit v1

## What this folder is
This folder serves as a repo-local reference bundle for the implementation of the "Detour" system within the Struxient flow engine. It contains specifications, failure scenarios, and testing plans designed to ensure that the implementation remains faithful to the intended detour semantics and failure realities.

**These scenarios are normative examples; implementation must satisfy them.**

## What it is not
- **Not Canon**: These are build-specific specs, not the fundamental project canon.
- **Not Product Docs**: This is for engineering reference, not end-user documentation.

## Kit Contents
1. [10_detour_examples_20_scenarios.md](./10_detour_examples_20_scenarios.md) - The primary source of truth for all 20 detour scenarios (1-15 Core Failure Playbook, 16-20 Extended Pressure-Tests).
2. [20_simulation_harness_spec.md](./20_simulation_harness_spec.md) - Specification for the simulation environment.
3. [30_why_cant_i_finish_explainer_contract.md](./30_why_cant_i_finish_explainer_contract.md) - Contract for state explanation logic.
4. [40_telemetry_plan.md](./40_telemetry_plan.md) - Plan for tracking detour-related events.
5. [50_contradiction_tests_plan.md](./50_contradiction_tests_plan.md) - "Must-fail" test scenarios to prevent invalid states.
6. [60_debug_panel_readonly_spec.md](./60_debug_panel_readonly_spec.md) - Specification for the read-only debug interface.

## Source of Truth
- **Primary examples source**: [10_detour_examples_20_scenarios.md](./10_detour_examples_20_scenarios.md) (this folder).
- **Legacy references**: Any older versions of detour scenarios in `docs/canon/` are deprecated and non-authoritative.

## How to Use This Kit During Implementation
- **Any ambiguity → add scenario or contradiction test first.** Do not invent semantics; encode them as a new test case.
- **No new primitives.** If you find yourself needing a concept not listed in Locked Decisions, stop and escalate.
- **All "blocked" UI must be explainable via explainer contract.** If the UI shows a block, there must be a matching ReasonCode.

## Locked Decisions
- **Stable Resume**: Detours must always define a resume target that ensures the flow continues from a safe, predictable point.
- **Validity Overlay**: Outcomes are marked with a validity state (VALID, PROVISIONAL, INVALID) that overlays the base flow state.
- **Detour vs Remediation**: Detours handle localized corrections; remediation loops are for structural root-cause fixes.
- **Completion Guard**: No flow can be marked COMPLETED while a detour is ACTIVE.
- **No Nested Detours (v1)**: To manage complexity, v1 of the detour system does not allow opening a detour from within an active detour.
