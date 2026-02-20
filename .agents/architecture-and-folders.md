# Architecture and Folder Structure

## 1) Stack Choice

- Runtime: React Native + Expo (prebuild/custom dev client).
- Language: TypeScript strict mode.
- State: Zustand (UI state) + domain services.
- Data: SQLite (or MMKV + SQLite hybrid) local only.
- Monorepo: `pnpm` workspaces + Turbo for task orchestration.

## 2) Folder Structure

```text
/Users/monis/Documents/New project
├── apps
│   └── mobile
│       ├── src
│       │   ├── app
│       │   ├── features
│       │   │   ├── onboarding
│       │   │   ├── dashboard
│       │   │   ├── rules
│       │   │   ├── lock
│       │   │   └── insights
│       │   ├── components
│       │   ├── hooks
│       │   ├── services
│       │   ├── stores
│       │   └── theme
│       ├── ios
│       ├── android
│       ├── app.json
│       └── package.json
├── packages
│   ├── domain
│   │   ├── src
│   │   │   ├── models
│   │   │   ├── policy-engine
│   │   │   └── use-cases
│   │   └── package.json
│   ├── persistence
│   │   ├── src
│   │   └── package.json
│   ├── native-enforcement
│   │   ├── src
│   │   └── package.json
│   ├── ui-kit
│   │   ├── src
│   │   └── package.json
│   └── test-utils
│       └── package.json
├── infra
│   ├── ci
│   └── release
├── docs
│   ├── decisions
│   └── compliance
└── .agents
```

## 3) Boundary Rules

- `packages/domain` has no UI/native dependencies.
- `apps/mobile` never implements enforcement logic directly; it calls domain + native adapters.
- Native platform code exposes only minimal bridge interfaces.
- Any new feature defines domain model + use-case first, then UI.

## 4) Future Extension Points

- Add `packages/coach` for AI coaching later without touching enforcement core.
- Add `packages/sync` for optional cloud sync in future.
- Add `apps/web` (admin/reporting) using same domain contracts.
- Add `packages/feature-flags` when experimentation starts.
