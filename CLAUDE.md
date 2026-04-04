# BC Games — Claude Guide
<!-- Global standards: ~/.claude/CLAUDE.md and ~/.claude/standards/ -->

## Stack
- **Backend:** Python 3, FastAPI, uvicorn (in-memory, no DB)
- **Frontend:** Expo TypeScript, runs in browser via Expo Web
- **Docs:** See `docs/` for testing, deployment, and workflow details

## Git Workflow
See [~/.claude/standards/git.md](~/.claude/standards/git.md).
- Never push directly to `main` or `dev`
- Branch: `git checkout dev && git checkout -b feat/<name>`
- PR: `feat/<name>` → `dev` → `main` (releases only)

## Running Locally
```bash
# Backend (Terminal 1)
cd backend && python -m pip install -r requirements.txt
python -m uvicorn main:app --reload   # http://localhost:8000

# Frontend (Terminal 2)
cd frontend && npm install
npx expo start --web                  # http://localhost:8081
```

## Testing
See [~/.claude/standards/testing.md](~/.claude/standards/testing.md) + [`docs/TESTING.md`](docs/TESTING.md) for project-specific test cases.
```bash
cd backend && python -m pytest tests/ -v
```

## iOS Builds
**Xcode Cloud (App Store Connect) — EAS Build is NOT used.** `frontend/ios/` is committed to the repo, not generated at build time. `/Volumes/workspace/repository/` in build logs is Apple's Xcode Cloud runner.
See [`docs/IOS.md`](docs/IOS.md). Do not suggest `eas build`, `prebuildCommand`, or treating `ios/` as ephemeral.

## Android Builds
**Gradle → Google Play Console (internal testing) — EAS Build is NOT used.** `frontend/android/` is committed to the repo (bare workflow), not generated at build time.
See [`docs/ANDROID-CI.md`](docs/ANDROID-CI.md). Do not suggest `eas build`, `eas submit`, or treating `android/` as ephemeral.

### Android Rules
- Before modifying files under `frontend/android/`: verify the change builds locally with `cd frontend/android && ./gradlew assembleDebug`.
- Never commit `upload-keystore.jks`, `debug.keystore`, or `local.properties` — these are gitignored for security.
- Never change the Gradle wrapper version (`gradle-wrapper.properties`) without verifying compatibility with current AGP and React Native Gradle Plugin.
- Read `docs/ANDROID-CI.md` before modifying `build.gradle`, `settings.gradle`, or `gradle.properties`.
- After any change to `build.gradle`, `settings.gradle`, or `gradle.properties`, verify `android-bundle-check` and `android-build-check` CI jobs pass before merging.
- `sentry.properties` must use environment variables for org/project/token — never hardcode Sentry credentials.

## Deployment
See [`docs/RENDER.md`](docs/RENDER.md) for Render hosting setup.

## Key Conventions
- All rule enforcement is server-side (`backend/game.py`). Frontend is display only.
- Frontend replaces state wholesale from each API response.
- Scoring category keys: `ones` `twos` `threes` `fours` `fives` `sixes`
  `three_of_a_kind` `four_of_a_kind` `full_house` `small_straight`
  `large_straight` `yacht` `chance`
- `EXPO_PUBLIC_API_URL` env var overrides `BASE_URL` in `frontend/src/api/client.ts`.
