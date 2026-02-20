# UI Style Guide (Clean, Minimal, ChatGPT-Like)

## 1) Design Goals

- Calm and low-noise interface.
- Fast readability with generous spacing.
- Neutral palette, one strong action color.
- Simple, text-first screens with clear hierarchy.

## 2) Design Tokens

```txt
Colors
- bg: #F7F7F8
- surface: #FFFFFF
- textPrimary: #111827
- textSecondary: #6B7280
- border: #E5E7EB
- success: #10A37F
- warning: #D97706
- danger: #DC2626

Spacing
- 4, 8, 12, 16, 20, 24, 32

Radius
- card: 14
- input: 999 (pill)
- modal: 20

Type
- title: 28/34 semibold
- h2: 20/26 semibold
- body: 16/22 regular
- caption: 13/18 regular
```

## 3) Component Rules

- Primary button: filled `success` color, high contrast text.
- Secondary button: white surface with border.
- Cards: white surface, subtle border, no heavy shadow.
- Inputs: rounded pill style; use concise labels.
- Charts: minimal labels and muted gridlines.

## 4) Screen Patterns

- Onboarding:
  - 1 permission per step.
  - Show why each permission is needed.
- Dashboard:
  - Today quota, next block window, quick toggle.
- Rule Builder:
  - App group select -> schedule -> quota -> strictness.
- Lock Screen:
  - reason shown, remaining cooldown, emergency override action.

## 5) Interaction Patterns

- Motion: short fades and slide-up (150-220ms), no decorative animation.
- Haptics: light confirmation for saves, warning haptic on blocked action.
- Tone: direct, neutral, non-judgmental language.

## 6) Accessibility

- Minimum text contrast 4.5:1.
- Dynamic type support for all text.
- Tap targets >= 44x44 pt.
- VoiceOver/TalkBack labels for all actions.
