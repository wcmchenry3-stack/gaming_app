# Performance Testing

Performance tests measure API response times and frontend Core Web Vitals. They are **non-blocking** — they never gate PRs or deploys, but run nightly and on-demand to catch regressions.

## Tools

| Layer | Tool | Config |
|---|---|---|
| Backend | [Locust](https://locust.io) 2.32.4 | `backend/perf/locustfile.py` |
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
  YahtzeeGameUser

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
EXPO_PUBLIC_API_URL=https://yahtzee-api.onrender.com npx expo export --platform web
npx lhci autorun --config=lighthouserc.json
```

Results are saved to `frontend/.lighthouseci/`. Open any `.html` file in a browser to view the full Lighthouse report.

---

## SLOs (Service Level Objectives)

Defined in `backend/perf/thresholds.json`. These are calibrated for the Render free-tier deployment, measured after the warm-up step.

| Scenario | Users | p95 target | Error rate |
|---|---|---|---|
| Game flow (sequential) | 1 | < 500 ms | 0% |
| Leaderboard concurrent | 10 | < 300 ms | < 1% |
| Read-only polling | 20 | < 200 ms | 0% |

**Frontend thresholds** (in `frontend/lighthouserc.json`):

| Metric | Warn threshold | Fail threshold |
|---|---|---|
| Performance score | < 0.75 | — (warn only) |
| Accessibility score | < 0.90 | **< 0.90 (hard fail — WCAG 2.2 AA)** |
| LCP | > 4000 ms | — (warn only) |
| CLS | > 0.25 | — (warn only) |
| TBT | > 600 ms | — (warn only) |

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

The Yahtzee backend has one global `game` variable. It is **not concurrent-safe**. Running the game flow with more than 1 user will cause state collisions (mixed round counts, wrong phase errors). This is expected and documented, not a bug in the tests.

The `YahtzeeGameUser` class must always be run with `--users 1`. Concurrent stress testing only applies to the leaderboard endpoints.

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
