# iOS Build — Xcode Cloud

## How iOS is built

This project builds iOS via **Xcode Cloud** (Apple's CI/CD in App Store Connect). EAS Build is **not used**.

## What this means

- `frontend/ios/` is **committed to the repo** — it is NOT gitignored and NOT generated at build time
- Xcode Cloud checks out the repo and expects `frontend/ios/GamingApp.xcworkspace` to exist
- The `/Volumes/workspace/repository/` path in build logs is **Xcode Cloud infrastructure**, not EAS
- Builds are triggered through App Store Connect

## If the ios/ folder is missing

The `frontend/ios/` directory must exist in the repo. If it is missing:

1. It was likely accidentally added to `.gitignore` — remove `/ios` from `frontend/.gitignore`
2. Run `expo prebuild` once to regenerate it: `cd frontend && npx expo prebuild`
3. Commit the generated `ios/` folder
4. Do **not** add `prebuildCommand` to `eas.json` — EAS is not the build target

## EAS status

EAS Build and `eas submit` are **not used** for this project — neither now nor planned. `eas.json` has been removed.

## CI / CD

iOS builds run via **Xcode Cloud** (App Store Connect), not GitHub Actions.
GitHub Actions `ci.yml` does not include an iOS build step.
The `/Volumes/workspace/repository/` path in Xcode Cloud logs is Apple's runner — not EAS.

## Do not suggest

- `eas build` for iOS
- `prebuildCommand` in `eas.json`
- Treating `ios/` as a generated/ephemeral directory
- Treating `ios/` as a generated/ephemeral directory
