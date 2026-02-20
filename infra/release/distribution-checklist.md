# Distribution Checklist (APK)

## Pre-release

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Android device tests complete:
  - [ ] time-limit block
  - [ ] open-limit block
  - [ ] intent->delay->allow ladder
  - [ ] emergency override + cooldown
  - [ ] permission revocation fail-closed behavior
  - [ ] reboot persistence and foreground service recovery

## Build

- [ ] Release keystore configured
- [ ] `pnpm --filter @boundly/mobile android:apk` completed
- [ ] APK signature verified

## Install checks

- [ ] Clean install on at least 2 devices
- [ ] Upgrade install over older APK retains local data
- [ ] Accessibility + usage access onboarding works

## Sharing

- [ ] Upload APK to private share link
- [ ] Share install + permission instructions with testers
- [ ] Capture tester OS/device matrix
