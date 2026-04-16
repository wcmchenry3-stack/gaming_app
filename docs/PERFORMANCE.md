# Performance Testing

Performance tests measure API response times and frontend Core Web Vitals. They are **non-blocking** — they never gate PRs or deploys, but run nightly and on-demand to catch regressions.

## Tools

| Layer    | Tool                                                           | Config                       |
| -------- | -------------------------------------------------------------- | ---------------------------- |
| Backend  | [Locust](https://locust.io) 2.32.4                             | `backend/perf/locustfile.py` |
| Frontend | [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) | `frontend/lighthouserc.json` |

---

## Running Locally

### Backend (Locust)

Requires the backend to be running first:

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m uvicorn main:app --reload   # keep this running
```

In a second terminal:

```bash
cd backend

# Game flow — single user, sequential (correct for global game state)
locust -f perf/locustfile.py \
  --headless --users 1 --spawn-rate 1 --run-time 60s \
  --host http://localhost:8000 --csv perf-gameflow \
  YachtGameUser

# Leaderboard — 10 concurrent users
locust -f perf/locustfile.py \
  --headless --users 10 --spawn-rate 2 --run-time 60s \
  --host http://localhost:8000 --csv perf-leaderboard \
  LeaderboardUser

# Read-only polling — 20 users
locust -f perf/locustfile.py \
  --headless --users 20 --spawn-rate 5 --run-time 60s \
  --host http://localhost:8000 --csv perf-readonly \
  ReadOnlyUser
```

Check results against thresholds:

```bash
cd backend
python perf/check_thresholds.py --csv perf-gameflow
python perf/check_thresholds.py --csv perf-leaderboard
python perf/check_thresholds.py --csv perf-readonly
```

Locust also has a browser UI. Omit `--headless` to open it at http://localhost:8089.

### Frontend (Lighthouse CI)

```bash
cd frontend
npm install
EXPO_PUBLIC_API_URL=https://dev-games-api.buffingchi.com npx expo export --platform web
npx @lhci/cli@0.14.0 autorun --config=lighthouserc.json
```

Results are saved to `frontend/.lighthouseci/`. Open any `.html` file in a browser to view the full Lighthouse report.

---

## SLOs (Service Level Objectives)

Defined in `backend/perf/thresholds.json`. These are calibrated for the Render free-tier deployment, measured after the warm-up step.

| Scenario               | Users | p95 target | Error rate |
| ---------------------- | ----- | ---------- | ---------- |
| Game flow (sequential) | 1     | < 500 ms   | 0%         |
| Leaderboard concurrent | 10    | < 300 ms   | < 1%       |
| Read-only polling      | 20    | < 200 ms   | 0%         |

**Frontend thresholds** (in `frontend/lighthouserc.json`):

| Metric              | Warn threshold | Fail threshold                       |
| ------------------- | -------------- | ------------------------------------ |
| Performance score   | < 0.75         | — (warn only)                        |
| Accessibility score | < 0.90         | **< 0.90 (hard fail — WCAG 2.2 AA)** |
| LCP                 | > 4000 ms      | — (warn only)                        |
| CLS                 | > 0.25         | — (warn only)                        |
| TBT                 | > 600 ms       | — (warn only)                        |

To update thresholds, edit `backend/perf/thresholds.json` or `frontend/lighthouserc.json`.

---

## CI Workflow

The `perf.yml` workflow runs:

- **Nightly at 06:00 UTC** against the production Render URLs
- **On demand** via GitHub Actions → "Run workflow" (configurable URL, users, duration)
- **Post-deploy** when called from `deploy.yml` (1-user smoke check)

To trigger manually:

1. Go to Actions → "Performance Tests" → "Run workflow"
2. Set the target URL (default: production), users, and duration

Artifacts (Locust CSVs and Lighthouse HTML reports) are retained for 30 days.

---

## Known Limitations

### Single global game instance

The Yacht backend has one global `game` variable. It is **not concurrent-safe**. Running the game flow with more than 1 user will cause state collisions (mixed round counts, wrong phase errors). This is expected and documented, not a bug in the tests.

The `YachtGameUser` class must always be run with `--users 1`. Concurrent stress testing only applies to the leaderboard endpoints.

### Render free-tier cold starts

The free tier shuts down after ~15 minutes of inactivity. Cold starts add 20–45 seconds to the first request. The CI workflow includes a warm-up step (up to 5 curl retries × 15s) before timing begins. First-request latency is not representative of steady-state performance.

### Matter.js runtime performance

Lighthouse measures initial load quality (LCP, CLS, TBT) on the static export. It does **not** measure frame rate or physics jank during gameplay. Runtime performance of the Matter.js physics engine requires a Playwright trace or browser DevTools recording — not covered by this setup.

---

## Reusable Pattern

This performance testing setup is designed to be extracted to `wcmchenry3-stack/.github` as shared callable workflows:

- `called-perf-backend.yml` — parametric Locust runner
- `called-perf-frontend.yml` — parametric Lighthouse CI runner

Other projects in the stack adopt the pattern by adding a `perf.yml` that calls these shared workflows with project-specific inputs (target URL, locustfile path, dist dir). See the shared repo for details.

---

## JS Bundle Baseline

> **Epic 2a — Story #527** | Measured: 2026-04-15 | Expo SDK 55 / Hermes / Android | No code changes in this section.

### Methodology

```bash
cd frontend
npx expo export --platform android --source-maps --output-dir dist-android-sourcemap
# source-map-explorer cannot parse .hbc directly; source map parsed manually for module breakdown
```

The Android export produces a single Hermes bytecode file. Module sizes below are estimated from `sourcesContent` in the accompanying `.hbc.map` source map (13 MB). Sizes reflect unminified source — Hermes compiles this down to **4.5 MB HBC** shipped on device.

### Bundle totals

| Component | Size |
|---|---|
| JS bundle (Hermes bytecode, shipped) | **4.5 MB** |
| JS bundle (source content in map, unminified) | 8.3 MB |
| Bundled assets (images, fonts, JSON) | **74.8 MB** |
| **Total on-device (JS + assets)** | **~79 MB** |

### JS module breakdown (top packages by source size)

| Package | Source size | % of JS | Notes |
|---|---|---|---|
| `react-native` | 2,364 KB | 27.8% | Framework — unavoidable |
| `react-native-reanimated` | 837 KB | 9.8% | Animation worklets |
| `@sentry/core` | 765 KB | 9.0% | ⚠️ See Sentry note below |
| `@sentry/react-native` | 413 KB | 4.8% | ⚠️ |
| `react-reconciler` | 377 KB | 4.4% | React runtime |
| `matter-js` | 366 KB | 4.3% | Cascade native physics (Android/iOS) — expected, not removable |
| `@shopify/react-native-skia` | 307 KB | 3.6% | GPU canvas for Cascade |
| `@sentry-internal/replay` | 299 KB | 3.5% | ⚠️ Session replay SDK |
| `react-native-gesture-handler` | 263 KB | 3.1% | Input handling |
| `@sentry/browser` | 213 KB | 2.5% | ⚠️ |
| `@react-navigation/core` | 158 KB | 1.9% | Navigation |
| `@react-native/virtualized-lists` | 152 KB | 1.8% | RN list components |
| `@sentry-internal/browser-utils` | 135 KB | 1.6% | ⚠️ |
| `expo` | 123 KB | 1.4% | |
| `@sentry/react` | 103 KB | 1.2% | ⚠️ |
| `react-native-screens` | 97 KB | 1.1% | |
| `react-native-worklets` | 97 KB | 1.1% | Reanimated worklets |
| `i18next` | 81 KB | 0.9% | Internationalization |
| `@sentry-internal/feedback` | 76 KB | 0.9% | ⚠️ Feedback widget SDK |
| `@sentry-internal/replay-canvas` | 32 KB | 0.4% | ⚠️ |
| `[app code]` | ~260 KB | ~3.1% | All game screens, engines, shared infrastructure |
| **Total mapped** | **8.3 MB** | 100% | |

### Findings

**⚠️ Sentry accounts for ~2.0 MB (24.5%) of JS source content** across seven packages: `@sentry/core`, `@sentry/react-native`, `@sentry-internal/replay`, `@sentry/browser`, `@sentry-internal/browser-utils`, `@sentry/react`, `@sentry-internal/feedback`, `@sentry-internal/replay-canvas`. The session replay and feedback SDKs add meaningful weight. Evaluate whether session replay is intentionally enabled — if not, it can be tree-shaken by removing the `Sentry.replayIntegration()` call.

**`matter-js` (366 KB) is active and expected.** Cascade's native engine (`engine.native.ts`) uses matter-js for polygon body physics on Android and iOS. `@dimforge/rapier2d-compat` (Rapier2D) is the web-only engine — it does **not** appear in the Android bundle. Metro's `.native.ts` platform resolution routes correctly.

**`@dimforge/rapier2d-compat` is absent from the Android bundle.** The `.native.ts` extension on `frontend/src/game/cascade/engine.native.ts` causes Metro to select the native engine (matter-js) on Android. Rapier2D is web-only and adds zero weight to the Android build.

**Pachisi is confirmed not bundled.** Zero Pachisi-related files appear in the 2,065 source files. The commented-out `App.tsx` route and absent import statement mean Metro excludes all of `src/game/pachisi/`, `src/components/pachisi/`, and `src/screens/PachisiScreen.tsx` from the Android bundle.

**App code is ~260 KB (~3.1%) of JS.** All five game engines, screens, shared infrastructure, and i18n strings together are a small fraction of the total. JS bundle size is not where the size problem lives — assets are.

**The 74.8 MB of bundled assets dominate.** See [Asset Inventory](#asset-inventory) for breakdown. Converting `fruit-icons/` + `celestial-icons/` (62.9 MB PNG) to WebP is the highest-ROI action available (Epic 2b).

---

## Build Configuration Baseline

> **Epic 2a — Story #528** | Confirmed: 2026-04-15 | Sources: `gradle.properties`, `android/app/build.gradle` | No code changes in this section.

### Confirmed configuration

| Setting | Current state | Source |
|---|---|---|
| **Store format** | **AAB** | Confirmed by user — manually uploaded to Google Play Console internal track |
| **ABI split** | Active via AAB | Play delivers per-ABI slices automatically from AAB |
| **ABIs built** | armeabi-v7a, arm64-v8a, x86, x86_64 | `gradle.properties:31` — all four ABIs compiled |
| **R8 / minify** | **OFF** | `build.gradle:69` — `enableMinifyInReleaseBuilds` defaults to `false`; not set in `gradle.properties` |
| **Resource shrinking** | **OFF** | `build.gradle:124-125` — `enableShrinkResourcesInReleaseBuilds` defaults to `'false'`; not set |
| **Legacy packaging** | `false` | `gradle.properties:62` — native libs not compressed in APK/AAB (correct) |
| **Hermes** | Enabled | `gradle.properties:42` — `hermesEnabled=true` |
| **New Architecture** | Enabled | `gradle.properties:38` — `newArchEnabled=true` |
| **PNG crunching** | Enabled in release | `gradle.properties:26` — `android.enablePngCrunchInReleaseBuilds=true` |
| **WebP support** | Enabled (static) | `gradle.properties:53-54` — `expo.webp.enabled=true`; animated WebP disabled |
| **GIF support** | Enabled | `gradle.properties:50` — `expo.gif.enabled=true` |

### Native library sizes (requires build)

The `.so` files for native modules are compiled from C++ source at build time (each package ships a `CMakeLists.txt`). They are **not pre-built in `node_modules/`** and cannot be measured without running the release build.

To measure, run:

```bash
cd frontend/android
./gradlew bundleDebug   # or bundleRelease with signing config

# Then use bundletool to extract per-ABI APKs and inspect .so sizes:
bundletool build-apks --bundle=app/build/outputs/bundle/debug/app-debug.aab \
  --output=/tmp/app.apks --mode=universal
unzip -o /tmp/app.apks -d /tmp/app-apks-extracted
# android-icon-background.png
# Inside /tmp/app-apks-extracted/universal.apk → lib/{abi}/*.so
```

Expected large contributors (approximate arm64-v8a sizes based on published release notes):

| Native library | Approx. arm64-v8a | Source |
|---|---|---|
| `react-native` core (Hermes VM + JSI) | ~6–8 MB | Published benchmarks |
| `@shopify/react-native-skia` | ~8–12 MB | GPU rendering engine |
| `react-native-reanimated` | ~3–5 MB | Worklets runtime |
| `@sentry/react-native` | ~1–2 MB | Crash reporting |
| `react-native-gesture-handler` | ~1 MB | Input handling |

> **Action for Epic 2b:** Once measured, populate a replacement table here with actual byte counts. The most impactful configuration change available right now (before measurement) is enabling R8 + resource shrinking — these are confirmed OFF and can be turned on in `gradle.properties`.

### Key flags for Epic 2b

- **R8 + resource shrinking are the highest-ROI build config change.** Enable by adding to `gradle.properties`:
  ```
  android.enableMinifyInReleaseBuilds=true
  android.enableShrinkResourcesInReleaseBuilds=true
  ```
  Requires proguard rules review — test against all game flows before shipping.

- **All 4 ABIs are built.** AAB delivery means Play strips unused ABIs per install, so the installed size is already ABI-correct. No action needed here.

- **PNG crunching is enabled** but all shipped images are already PNG. WebP conversion (Epic 2b) supersedes crunching for game assets.

---

## Asset Inventory

> **Epic 2a — Story #529** | Measured: 2026-04-15 | No code changes in this section.

### Directory map

| Directory | Size | Files | Bundled? | Owner / Purpose |
|---|---|---|---|---|
| `assets/source-icons/cosmos/` | 85.6 MB | 12 PNG | No | Pipeline input — master source files for `npm run process-assets`. Not imported by app code. |
| `assets/source-icons/fruits/` | 76.8 MB | 12 PNG | No | Pipeline input — same as above. |
| `assets/celestial-icons/` | 36.8 MB | 12 PNG | **Yes** | Cosmos theme UI icons. Imported in `src/theme/fruitSets.ts`. |
| `assets/fruit-icons/` | 26.1 MB | 12 PNG | **Yes** | Fruits theme UI icons. Imported in `src/theme/fruitSets.ts`. |
| `assets/logo.png` | 7.1 MB | 1 PNG | **Yes** | App logo. Imported in `src/components/shared/AppHeader.tsx`. |
| `assets/adaptive-icon.png` | 7.1 MB | 1 PNG | Platform only | Android adaptive icon (`app.json`). Identical file to `logo.png`. |
| `assets/icon.png` | 7.1 MB | 1 PNG | Platform only | App icon (`app.json`). Identical file to `logo.png`. |
| `assets/cosmos-baked/` | 1.2 MB | 12 PNG | **Yes** | Cosmos game pieces (Skia pre-composited). Imported in `src/theme/useFruitImages.ts`. |
| `assets/fruits-baked/` | 1.0 MB | 12 PNG | **Yes** | Fruits game pieces (Skia pre-composited). Imported in `src/theme/useFruitImages.ts`. |
| `assets/cosmos-vertices.json` | 43 KB | 1 JSON | **Yes** | Cascade physics polygon vertices for Cosmos theme. |
| `assets/fruit-vertices.json` | 58 KB | 1 JSON | **Yes** | Cascade physics polygon vertices for Fruits theme. |
| `assets/*.png` (Android icons, splash, favicon) | ~0.2 MB | 4 PNG | Platform only | App store / launcher assets. |
| **Repo total** | **248.9 MB** | 82 files | | |
| **Bundled game assets** | **~72 MB** | | | `celestial-icons` + `fruit-icons` + `logo` + `*-baked` + JSON |
| **Not bundled (pipeline inputs)** | **162.4 MB** | | | `source-icons/` — needed locally, not shipped |

### Asset pipeline

The `source-icons/` directories are the master source files for the Cascade game piece pipeline:

```
source-icons/{fruits,cosmos}/*.png   →   npm run process-assets   →   {fruits,cosmos}-baked/*.png
                                         (remove_backgrounds.py)
```

The baked outputs are the files actually used for in-game Skia rendering. The `*-icons/` files (medium-size PNGs) are used for UI display (selection screens, theme pickers) and are a separate set from the baked game-piece textures.

### Two-tier image architecture

Each theme set ships two separate image tiers:

| Tier | Directories | Size | Use |
|---|---|---|---|
| **UI icons** (large) | `fruit-icons/`, `celestial-icons/` | 62.9 MB | `fruitSets.ts` — theme selector, previews |
| **Baked game pieces** (small) | `fruits-baked/`, `cosmos-baked/` | 2.2 MB | `useFruitImages.ts` — in-game Skia canvas |

### Findings and flags for Epic 2b

1. **`celestial-icons/` + `fruit-icons/` = 62.9 MB of large PNGs bundled into the app.** These are the highest-priority WebP conversion candidates. At typical WebP compression ratios for photographic content (70–80% reduction), conversion could save ~44–50 MB from the shipped app.

2. **`source-icons/` (162.4 MB) live inside `frontend/assets/`** alongside bundled assets. Metro does not bundle unreferenced files, so these are not shipped — but their location is misleading and creates risk of accidental inclusion if a future developer imports one. Recommend moving them to a dedicated `assets-source/` directory outside `frontend/assets/`, or documenting their role clearly in `CONTRIBUTING.md`.

3. **`adaptive-icon.png`, `icon.png`, and `logo.png` are identical files** (confirmed by MD5 hash). `logo.png` is bundled (imported by `AppHeader.tsx`); the other two are platform-only. The 7.1 MB master is large for an in-app logo — this should be replaced with a purpose-sized PNG or WebP in Epic 2b.

4. **`pumpkin` (fruit) and `milkyway` (cosmos) are "reserved for future use"** but are statically imported in `fruitSets.ts` (lines 14, 26) and therefore bundled. Combined size: ~6.7 MB. These can be removed from the import list until the tier is actually needed.

5. **`cosmos-baked/` includes `milkyway.png`** but `useFruitImages.ts` does not import it (only 11 of 12 cosmos items are loaded). The file is in the directory but unreferenced by `useFruitImages.ts`; it may be referenced via `fruitSets.ts` — verify before flagging for removal.

### Not orphaned (corrects Epic 2a assumption)

The epic listed `/celestial_images/` as "suspected dead weight." Investigation found:
- The actual paths are `celestial-icons/` and `cosmos-baked/` (not `celestial_images/`).
- Both are actively imported and in use.
- A third set (`source-icons/cosmos/`) is the pipeline input — intentional and necessary locally.
