---
name: mobile-enforcement-architecture
description: Design and implement hard-enforcement app blocking for iOS and Android with an offline-first policy engine. Use when defining rules, platform adapters, anti-bypass flows, or permission fallback behavior.
---

# Mobile Enforcement Architecture

## Objective

Deliver strict, deterministic app blocking across platforms while keeping enforcement logic shared and testable.

## Workflow

1. Define shared domain entities:
   - `TargetApp`
   - `ScheduleWindow`
   - `QuotaPolicy` (time + opens)
   - `OverridePolicy`
   - `EnforcementDecision`
2. Implement pure policy evaluator:
   - Inputs: current time, usage snapshot, configured rules, override history.
   - Output: `allow` or `block` plus reason and next state.
3. Implement native adapters:
   - iOS: FamilyControls + DeviceActivity + ManagedSettings adapter.
   - Android: UsageStats + Accessibility + foreground enforcement service.
4. Add bypass resistance:
   - cooldown lock after override
   - penalty applied immediately
   - strict behavior if permission is revoked
5. Cover edge cases in tests:
   - timezone changes
   - midnight reset
   - overlapping schedules
   - app relaunch loops

## Guardrails

- Never reimplement policy logic in UI screens.
- Keep domain package independent from native/UI dependencies.
- Log every block and override locally for auditability.
