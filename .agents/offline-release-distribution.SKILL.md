---
name: offline-release-distribution
description: Plan and execute low-cost offline-friendly distribution for a React Native app across Android and iOS. Use when deciding share methods, signing flow, and rollout phases under budget constraints.
---

# Offline Release Distribution

## Objective

Maximize zero-cost distribution early while keeping a clear path to scalable releases.

## Workflow

1. Android first:
   - produce signed APK
   - test install flow from shared link/file
   - include in-app version and update check messaging
2. iOS constraints:
   - treat free Personal Team sideload as tiny internal testing only
   - do not assume broad free iOS distribution
3. Define phased rollout:
   - Phase A: Android APK + limited iOS manual sideload
   - Phase B: paid Apple Developer + TestFlight
4. Add release checklist:
   - permission messaging
   - crash monitoring
   - rollback and hotfix process

## Guardrails

- Do not claim iOS install-by-link for free public distribution.
- Keep signing secrets out of repository.
- Keep release notes and upgrade steps inside the app.
