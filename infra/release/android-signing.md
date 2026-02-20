# Android Signing (Boundly)

## 1) Generate release keystore

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore boundly-release-key.keystore \
  -alias boundly-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

## 2) Configure Gradle properties (local only)

Add to `apps/mobile/android/gradle.properties` or user-level `~/.gradle/gradle.properties`:

```properties
BOUNDLY_UPLOAD_STORE_FILE=boundly-release-key.keystore
BOUNDLY_UPLOAD_KEY_ALIAS=boundly-key-alias
BOUNDLY_UPLOAD_STORE_PASSWORD=***
BOUNDLY_UPLOAD_KEY_PASSWORD=***
```

## 3) Update `apps/mobile/android/app/build.gradle`

Create a `release` signing config that reads values from properties and switch release builds to that signing config.

## 4) Build release APK

```bash
pnpm --filter @boundly/mobile android:apk
```

Output path:
- `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## 5) Verify signature

```bash
apksigner verify --print-certs apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```
