# Platform Notes

## iOS

- Family Controls capability requires entitlement and policy compliance.
- Free personal provisioning is not designed for broad beta distribution.

## Android

- UsageStats and Accessibility permissions must be clearly explained in onboarding.
- Foreground service is required for resilient enforcement on many OEM builds.
- Required runtime/settings flows in V1:
  - Usage Access settings
  - Accessibility service enablement
  - Ignore battery optimization
