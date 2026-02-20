# Product Roadmap (Offline, Hard Enforcement, Cross-Platform)

## 1) Product Goal

Build a mobile app that enforces strict limits on distracting apps (Instagram, WhatsApp, LinkedIn, YouTube) with offline-first operation and simple UI.

## 2) Hard Enforcement Definition (V1)

Hard enforcement in V1 means:
- Rule-based blocking windows are applied automatically.
- Daily quota limits are enforced and lock when exhausted.
- Unlocks require explicit override flow (cooldown + friction), not one-tap bypass.
- All core behavior works without cloud connectivity.

## 3) Platform Reality and Enforcement Strategy

### iOS
- Use `FamilyControls`, `DeviceActivity`, `ManagedSettings`.
- User selects apps/categories via Apple-provided picker.
- Blocking and schedules run via system APIs after permission.
- Constraint: entitlement approval and Apple policy compliance are mandatory.

### Android
- Use `UsageStatsManager` + foreground/accessibility enforcement service.
- Enforce rules with local policy engine and overlay/block screen.
- Constraint: aggressive battery policies and OEM process killing require resilience work.

## 4) V1 Feature Set (Must Have + Differentiation)

### Must Have
- App selection + grouped profiles (`Work`, `Sleep`, `Deep Focus`).
- Daily time limits per app/profile.
- Schedule-based blocks by weekday + time range.
- Strict lock screen when app is blocked.
- Emergency unlock with configurable penalty (e.g., lose 15 min quota).
- Local-only analytics: usage, attempts, unlock events.

### Standout Features (included in V1)
- Progressive friction ladder:
  1) Intent prompt
  2) Delay (10-30s)
  3) Hard lock
- Open-count limit per app/day (not only time-based).
- Relapse mode: auto-tighten limits next day after repeated overrides.

## 5) Out of Scope for V1

- Cross-device sync/account system.
- Social leaderboard/community.
- AI coaching chat.
- Desktop companion apps.

## 6) Milestones

## M0: Foundation (Week 1)
- Monorepo setup.
- Shared domain model.
- Design token system.
- Local storage setup.

## M1: Enforcement Core (Weeks 2-4)
- Policy engine (rules/schedules/quota/fallback states).
- iOS enforcement bridge.
- Android enforcement bridge.
- Reliable background monitoring.

## M2: Product UX (Weeks 5-6)
- Onboarding and permissions.
- Rule creation flow.
- Dashboard + lock screens.
- Weekly insight screens (local data).

## M3: Quality + Distribution (Weeks 7-8)
- E2E tests for critical paths.
- Crash/ANR monitoring setup.
- Internal release pipeline (APK/IPA distribution).
- App store readiness checklist.

## 7) Deployment Strategy

### Phase A (Immediate)
- Android: signed APK for sideload sharing.
- iOS: TestFlight internal/external testers.

### Phase B
- Closed beta with 20-50 users.
- Iterate on false positives and bypass loopholes.

### Phase C
- Store submission with policy and permission narratives.

## 8) Success Metrics

- 7-day retention > 35%.
- Distracting app time reduction >= 30% median in 2 weeks.
- Bypass/uninstall within 72h < 20%.
- Crash-free sessions > 99.5%.

## 9) Risks and Mitigations

- iOS entitlement/policy delays:
  - Mitigation: apply entitlement early; keep iOS-specific fallback UX.
- Android service killed by OEM:
  - Mitigation: foreground service + battery optimization education + watchdogs.
- User churn from over-strict blocking:
  - Mitigation: friction ladder + recovery mode.
