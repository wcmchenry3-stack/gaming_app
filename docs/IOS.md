# iOS Build — Xcode (Direct)

## How iOS is built

This project builds iOS **directly in Xcode**. EAS Build (Expo Application Services) is **not used**.

## What this means

- `frontend/ios/` is **committed to the repo** — it is NOT gitignored and NOT generated at build time
- `expo prebuild` is **not** part of the build process
- Builds are triggered from Xcode (locally or via CI with `xcodebuild`)
- The workspace is `frontend/ios/GamingApp.xcworkspace`

## If the ios/ folder is missing

The `frontend/ios/` directory must exist in the repo. If it is missing:

1. It was likely accidentally added to `.gitignore` — remove `/ios` from `frontend/.gitignore`
2. Run `expo prebuild` once to regenerate it: `cd frontend && npx expo prebuild`
3. Commit the generated `ios/` folder
4. Do **not** add `prebuildCommand` to `eas.json` — EAS is not the build target

## EAS status

`eas.json` exists and is intentionally kept for future use. When the app goes to production,
EAS will be used for **App Store submission** (`eas submit`), not for building.
Builds will remain Xcode-direct even then unless explicitly decided otherwise.

**Do not** treat the presence of `eas.json` as evidence that EAS Build is in use.

## CI / CD

The GitHub Actions `ci.yml` does not run iOS builds. iOS builds run via Xcode directly.
If a CI iOS build step is added in future, it must call `xcodebuild` (not `eas build`).

## Do not suggest

- `eas build` for iOS
- `prebuildCommand` in `eas.json`
- Treating `ios/` as a generated/ephemeral directory
- Removing `eas.json` — it is kept intentionally for future App Store submission
