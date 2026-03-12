# Boundly Build Summary (Android-first, Offline)

## What we are building
Boundly is a simple, offline-first Android app that enforces daily time limits on selected apps using native Android services. It focuses on hard enforcement (real blocking), minimal UI, and local-only data.

## Core features (current)
- Android hard enforcement using UsageStats + Accessibility + Foreground Service.
- Multi-app enforcement: add/remove apps and edit per-app daily limits.
- Simple step flow: grant permissions → pick app → set limit → start enforcement.
- Live usage list with per-app status (Live/Blocked/Not managed) and remaining minutes.
- Lock screen with a rotating quote (JSON-backed, sequential) and 6s auto-close; “Open Boundly” button.
- Boundly app is excluded from enforcement (cannot block itself).
- Offline-only storage with local SQLite + 30-day retention pruning.
- Baseline usage on first managed day to avoid penalizing prior usage.
- Fallback usage tracking if UsageStats lags or fails.
- Error log panel for diagnostics (local log history).

## Enforcement behavior
- If a managed app exceeds its daily limit, the lock screen appears with a quote and the app is blocked.
- Accessibility events are the real-time source of blocking; foreground service keeps policy fresh and resilient.
- Service restart handling after recents swipe + self-heal on stale heartbeat.

## Platform status
- Android: production enforcement path.
- iOS: scaffold only (no hard enforcement).

## What has been implemented so far (high level)
- Native Android enforcement module, foreground service, restart receiver, accessibility service.
- Policy evaluation with self-package exclusion and time-only limits.
- Quote system: large JSON bank + sequential rotation + improved lock screen UI.
- Multi-app UI and state management (add/remove/edit limits).
- Usage baseline + fallback counters to prevent false “over-limit” display.
- Diagnostics and health reporting in the app.

## Distribution (current)
- EAS CLI builds used for APK distribution (internal/preview profile).

## Known limits / not in scope (current)
- No cloud sync or accounts.
- No iOS FamilyControls enforcement yet.
- No App Store/TestFlight distribution.
