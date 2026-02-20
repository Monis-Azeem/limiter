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

- [ ] EAS project linked (`apps/mobile/eas.json` + `expo.extra.eas.projectId`)
- [ ] `pnpm --filter @boundly/mobile eas:android:preview` completed
- [ ] Build URL + artifact URL recorded

## Install checks

- [ ] Clean install on at least 2 devices
- [ ] Upgrade install over older APK retains local data
- [ ] Accessibility + usage access onboarding works

## Sharing

- [ ] Upload APK to private share link
- [ ] Share install + permission instructions with testers
- [ ] Capture tester OS/device matrix
