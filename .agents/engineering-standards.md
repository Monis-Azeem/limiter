# Engineering Standards

## 1) Code Standards

- TypeScript with `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Ban `any` unless explicitly justified with TODO and issue reference.
- Use ESLint + Prettier or Biome; enforce in CI.
- Keep domain logic pure and deterministic.

## 2) Architecture Standards

- Enforce layered boundaries:
  - UI -> app services -> domain use-cases -> persistence/native adapters.
- No direct native calls from feature screens.
- Every critical flow represented by domain-level unit tests.

## 3) Testing Strategy

- Unit: domain and policy-engine logic (high coverage).
- Integration: repositories + adapters.
- UI tests: React Native Testing Library for core screens.
- E2E: Detox/Appium for enforcement critical path.
- Release gate: block merges on failing tests/lint/typecheck.

## 4) Reliability and Security

- Store policy/rules locally with encrypted-at-rest options where possible.
- Add tamper checks for rule mutation and time changes.
- Use structured logs for enforcement events.
- Add crash and ANR monitoring before beta rollout.

## 5) Git and Review Rules

- Branch naming: `codex/<feature-or-fix>`.
- Conventional commits.
- PR template requires:
  - user impact
  - test evidence
  - risk notes
  - rollback plan

## 6) Release and Distribution

- Android:
  - internal APK distribution first, then closed testing track.
- iOS:
  - TestFlight for internal and external testers.
- Keep signing configs out of repo; use secure secrets.

## 7) Future-Proofing Rules

- Any new feature starts with ADR in `docs/decisions`.
- Add feature flags before behavior experiments.
- Keep optional cloud sync as isolated package (`packages/sync`) for later.
