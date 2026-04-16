# Android CI/CD — Build Infrastructure

## IMPORTANT: We use Play Console, NOT EAS Build or Xcode Cloud

Android releases are built locally with Gradle and uploaded manually to **Google Play Console** (internal testing track). EAS Build is **not used**. Xcode Cloud is iOS-only. Do not suggest EAS Build or Xcode Cloud fixes for Android build failures.

## Why `npm ci` must run before Gradle

`node_modules/` is gitignored. Gradle's `settings.gradle` calls
`node --print require.resolve(...)` at configuration time to locate React Native
and Expo modules. If `node_modules/` is missing, Gradle configuration fails with:

```
Cannot run program "node": error=2, No such file or directory
```

Always install JS dependencies before any Gradle command — both locally and in CI.

## Bare workflow

`frontend/android/` is committed (bare Expo workflow). Running `expo prebuild`
locally regenerates it. The committed `android/` directory is used directly for
Gradle builds — no prebuild step happens in CI.

## Signing configuration

- **Debug**: uses `app/debug.keystore` (standard Android debug key, gitignored)
- **Release**: uses `app/upload-keystore.jks` (gitignored), passwords via env vars
  - Keystore passwords are stored as GitHub Actions secrets
  - Fallback passwords in `app/build.gradle` are for local development only

**Critical**: Never commit keystores or `local.properties` — they are gitignored
for security.

## Key Gradle files

| File                                                        | Purpose                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| `frontend/android/build.gradle`                             | Root project: repositories, plugin dependencies         |
| `frontend/android/app/build.gradle`                         | App module: SDK versions, signing, dependencies, Sentry |
| `frontend/android/settings.gradle`                          | Module includes, React Native + Expo autolinking        |
| `frontend/android/gradle.properties`                        | JVM args, architecture list, Hermes/New Arch toggles    |
| `frontend/android/gradle/wrapper/gradle-wrapper.properties` | Gradle distribution version (currently 8.13)            |
| `frontend/android/sentry.properties`                        | Sentry CLI config (uses env vars for org/project/token) |

## JS bundle validation (GitHub Actions)

The `android-bundle-check` CI job runs `npx expo export:embed --platform android`
on every PR to verify the JS bundle can be created. This catches silent bundling
failures before they reach a Play Console upload.

The `android-build-check` CI job compiles Debug mode via `./gradlew assembleDebug`.
Debug builds skip JS bundling (Metro dev server is expected), so it only validates
native compilation. The bundle check covers JS.

## Release build smoke test (GitHub Actions)

The `android-release-smoke` CI job runs `./gradlew assembleRelease` for a single
ABI (arm64-v8a) on PRs that change Android-relevant files (`frontend/android/`,
`frontend/package.json`, `frontend/package-lock.json`). This catches release-only
failures that the debug build cannot detect:

- Sentry source map upload issues (only runs on release builds)
- Release CMake configuration errors (e.g. JDK compatibility)
- ProGuard/R8 shrinking issues

The job uses JDK 17 (Zulu) to avoid JDK 22+ restricted-method warnings that AGP
misinterprets as build errors.

## Sentry CLI auth validation (GitHub Actions)

The `sentry-cli-check` CI job validates the `SENTRY_AUTH_TOKEN` secret by running
`npx sentry-cli info`. This catches expired or misconfigured tokens before they
break release builds. If the token is not set, the job warns but does not fail.

## Gradle wrapper security

The `gradle-wrapper-check` CI job validates the Gradle wrapper JAR checksum to
prevent supply-chain attacks. Never replace `gradlew` or `gradle-wrapper.jar`
manually — use `gradle wrapper --gradle-version=X.Y.Z` to upgrade.

The job also flags changes to `gradle.properties`, `gradle-wrapper.properties`,
and `package.json` with warnings to verify release build compatibility.

## Sentry integration

`@sentry/react-native` applies `sentry.gradle` in `app/build.gradle` conditionally
— only when `SENTRY_AUTH_TOKEN` is set. This means local builds and CI builds
without the token skip source map upload instead of failing. The plugin reads
`sentry.properties` for the CLI path and falls back to `SENTRY_ORG`,
`SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` env vars.

## Key differences from iOS CI

| Aspect           | iOS                        | Android                                   |
| ---------------- | -------------------------- | ----------------------------------------- |
| Build system     | Xcode Cloud                | Gradle → Play Console                     |
| Native deps      | CocoaPods (`pod install`)  | Gradle (automatic)                        |
| Lock file        | `Podfile.lock` (committed) | None (Gradle resolves dynamically)        |
| CI compile check | `ios-build-check` (macOS)  | `android-build-check` (Linux)             |
| Bundle check     | iOS bundle check           | `android-bundle-check` (Android platform) |
| Signing          | Xcode managed              | Keystore + env vars                       |
