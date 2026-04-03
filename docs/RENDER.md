# Deploying to Render

## Overview

Two services are deployed via the `render.yaml` blueprint at the repo root:

| Service | Type | Custom Domain |
|---------|------|---------------|
| `gaming-app-api` | Python Web Service | `https://dev-games-api.buffingchi.com` |
| `gaming-app-frontend` | Static Site | `https://dev-games.buffingchi.com` |

The frontend's `EXPO_PUBLIC_API_URL` is automatically wired to the backend's URL by the blueprint.

## First-Time Setup

1. Push your code to GitHub (or confirm it's already there).
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo: `wcmchenry3-stack/gaming_app`.
4. Render will detect `render.yaml` and preview both services.
5. Click **Apply** — Render builds and deploys both services.

That's it. No manual env var configuration needed.

## Redeployment

Any push to the tracked branch (`main` by default) triggers an auto-redeploy.
To change the tracked branch per service: Render Dashboard → Service → Settings → Branch.

## Important Notes

**Free tier spin-down:** Render free web services sleep after 15 minutes of inactivity.
The first request after sleep takes ~30 seconds. Upgrade to a paid plan to avoid this.

**In-memory state:** The backend holds game state in memory. Any redeploy or spin-down
resets any game in progress. A future improvement would be to add a database.

**Service names:** If you rename services in `render.yaml`, update the `fromService.name`
reference on `EXPO_PUBLIC_API_URL` to match, or the frontend build will fail.

## Environment Variables

| Variable | Service | Value |
|----------|---------|-------|
| `EXPO_PUBLIC_API_URL` | gaming-app-frontend | Auto-set from `gaming-app-api` URL |
| `PYTHON_VERSION` | gaming-app-api | `3.11.0` |

To override `EXPO_PUBLIC_API_URL` manually (e.g., custom domain):
Render Dashboard → `gaming-app-frontend` → Environment → set the variable directly.
The static site must be redeployed after changing it (env vars are baked in at build time).
