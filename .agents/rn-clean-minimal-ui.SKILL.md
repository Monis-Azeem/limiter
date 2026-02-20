---
name: rn-clean-minimal-ui
description: Build a clean, simple ChatGPT-like React Native interface with strong hierarchy and low visual noise. Use when creating screen layouts, components, tokens, and accessibility behavior.
---

# RN Clean Minimal UI

## Objective

Maintain a calm, text-first interface that feels lightweight while still supporting strict enforcement states.

## Workflow

1. Define tokens first:
   - neutral background/surface palette
   - one primary accent color
   - fixed spacing/radius/type scale
2. Build primitive components:
   - `Screen`, `Card`, `Button`, `Input`, `SectionHeader`, `MetricRow`
3. Apply consistent layout:
   - single-column content
   - generous vertical spacing
   - short labels and clear primary action
4. Implement lock-state UX:
   - reason text
   - countdown/cooldown timer
   - one emergency override entry point
5. Validate accessibility:
   - contrast >= 4.5:1
   - hit target >= 44x44
   - VoiceOver/TalkBack labels

## Guardrails

- Keep copy neutral and non-judgmental.
- Avoid decorative animations; use short transitions only.
- Avoid custom one-off component styles; extend primitives.
