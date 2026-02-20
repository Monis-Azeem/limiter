# ADR 0001: Platform and Distribution

## Status

Accepted

## Decision

- Use React Native + Expo prebuild.
- Ship Android-first via APK for zero-cost distribution.
- Keep iOS in repo, but treat free sideload as limited internal testing.

## Consequences

- Faster iteration and shared logic across platforms.
- iOS broad distribution postponed until paid Developer Program enrollment.
