# Boundly

Cross-platform mobile app prototype for strict app usage enforcement.

## Stack

- Monorepo: `pnpm` + `turbo`
- Mobile: React Native + Expo prebuild
- Language: TypeScript strict mode
- Shared logic: `@boundly/domain` policy engine

## Workspace Layout

- `apps/mobile`: mobile app shell and feature screens
- `packages/domain`: deterministic enforcement policy engine
- `packages/persistence`: repository interfaces and in-memory adapter
- `packages/native-enforcement`: native bridge contracts + mock adapter
- `packages/ui-kit`: design tokens and primitive components
- `.agents`: product, architecture, style, and quality docs

## Quick Start

```bash
pnpm install
pnpm dev
```

## Current State

- Foundation scaffold complete.
- Shared policy engine + retention/event models implemented.
- SQLite repository with migrations, CRUD, usage/audit events, and retention prune implemented.
- Android native enforcement module implemented:
  - UsageStats collection
  - Accessibility lock interception
  - Foreground watchdog service
  - Boot receiver for restart
- iOS native bridge scaffold stub added (non-production enforcement).

## Build and Checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Android release script:

```bash
pnpm --filter @boundly/mobile android:apk
```

Note: Android Gradle builds require local JDK installation.

## Android Share Link (EAS Cloud Build)

Use EAS Build when you want a cloud-generated install link (no local Android Studio build required):

```bash
pnpm --filter @boundly/mobile eas:android:preview
```

That creates an internal-distribution APK and returns an Expo build URL you can share.
