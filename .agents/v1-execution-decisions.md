# V1 Execution Decisions (Locked)

Date locked: 2026-02-20

App identity:
- Name: `Boundly`
- iOS bundle id: `com.boundly.app`
- Android package id: `com.boundly.app`

## 1) Framework

- Decision: `React Native + Expo prebuild` with custom native modules.
- Why:
  - Lower setup overhead than bare RN.
  - Still allows native iOS/Android enforcement integrations.
  - Good path for internal iteration and future store release.

## 2) Android Enforcement Mode

- Decision: `UsageStats + Accessibility + foreground service`.
- Why:
  - Works on normal consumer devices.
  - Supports hard blocking with local-only policy engine.
  - Better fit than Device Owner mode for public users.

## 3) iOS Distribution (Free Constraint)

- Decision for now: iOS app built in same repo, but practical rollout is Android-first.
- Free iOS option:
  - Personal Team sideload via Xcode only.
  - Provisioning profile validity is short (7 days), not scalable for many testers.
- Scalable iOS option (later):
  - Enroll in Apple Developer Program and use TestFlight.

## 4) Emergency Override Policy

- Decision: 1 override/day with 15-minute penalty.
- Why:
  - Maintains strictness.
  - Reduces uninstall risk compared to zero-override policy.

## 5) Default V1 Profiles

- Decision: pre-create `Work`, `Sleep`, and `Deep Focus`.
- Why:
  - Fast onboarding.
  - Matches common behavior-change patterns.
  - Still allow custom profiles after initial setup.

## 6) Release Strategy

### Phase A (Free)

- Android: signed APK sharing via file/link.
- iOS: optional personal sideload for very small internal group only.

### Phase B (Scalable iOS)

- Add paid Apple Developer account.
- Move iOS distribution to TestFlight.

## 7) Guardrail

- Do not design core product behavior around free iOS sideload.
- Build enforcement core platform-agnostic in shared domain package.

## 8) Source References

- Apple membership capabilities and free Personal Team limits:
  - https://developer.apple.com/support/compare-memberships
- iOS Family Controls entitlement setup:
  - https://developer.apple.com/documentation/FamilyControls/distributing-your-app-with-the-family-controls-capability
- Android UsageStats API:
  - https://developer.android.com/reference/android/app/usage/UsageStatsManager
