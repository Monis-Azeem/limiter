---
name: mobile-quality-gates
description: Enforce quality gates for a TypeScript React Native app with native integrations. Use when defining test plans, CI rules, release checks, and regression-prevention standards.
---

# Mobile Quality Gates

## Objective

Prevent enforcement regressions and shipping failures by enforcing automated quality gates.

## Workflow

1. Run static gates on every PR:
   - typecheck
   - lint
   - format verification
2. Run unit tests for domain logic:
   - schedules, quotas, overrides, and reset behavior
3. Run integration tests:
   - local storage repositories
   - native adapter contracts
4. Run critical-path E2E:
   - onboarding permissions
   - blocked app flow
   - emergency override flow
5. Block merge on failing gates.

## Release Gates

- Crash-free rate target set before beta.
- Permission revocation flow manually verified.
- Distribution artifact install-tested on real devices.

## Guardrails

- No direct merge to main without green CI.
- No feature completion claim without test evidence.
