# ADR 0002: Shared Policy Engine

## Status

Accepted

## Decision

- Keep enforcement logic in `packages/domain`.
- Use native adapters only for app detection, usage retrieval, and shield application.
- Evaluate policy with deterministic pure functions.

## Consequences

- Lower cross-platform divergence.
- Easier testing and fewer regressions in enforcement behavior.
