# Mobile: Fruit rendering still uses plain circles with incorrect collision boundaries

## Problem

The recent fruit rendering and collision boundary fixes (commit `671c584`) only took effect on **web**. On **mobile (iOS/Android)**, the Cascade game still shows:

- **Plain circles** instead of fruit sprite images with proper clipping
- **Circle-based collision boundaries** instead of shape-accurate convex hull polygons
- **No boundary escape detection** — fruits can leave the play area undetected

## Root Cause

The app uses Metro's platform-specific file resolution (`.web.tsx` / `.native.ts`), so the web fixes never touched the mobile code paths:

| Feature | Web (fixed) | Mobile (broken) |
|---|---|---|
| **Physics engine** | `engine.ts` — Rapier (WASM) | `engine.native.ts` — Matter.js |
| **Collision shapes** | Convex hull polygons from vertex data | Hard-coded circles (`Matter.Bodies.circle`) |
| **Rendering** | `GameCanvas.web.tsx` — Canvas 2D with clipping, background fill, sprite offset/scale | `GameCanvas.tsx` — Skia, basic image/circle draw |
| **Boundary escape detection** | Yes (with Sentry logging) | None |
| **Vertex data usage** | Loads `fruit-vertices.json`, applies RDP simplification | `collisionVerts: null` — explicitly skipped |

## Files That Need Updates

1. **`frontend/src/game/cascade/engine.native.ts`** — Currently sets `collisionVerts: null` (line ~102) and uses `Matter.Bodies.circle`. Needs to use `Matter.Bodies.fromVertices` with the vertex data from `fruit-vertices.json`.
2. **`frontend/src/components/cascade/GameCanvas.tsx`** (Skia renderer) — Needs sprite clipping to circular boundary, background fill behind sprites, and sprite offset/scale alignment to match what web does.
3. **Boundary escape detection** — Port the escape detection logic from `engine.ts` (lines 259-292) to `engine.native.ts`.

## Acceptance Criteria

- [ ] Mobile renders fruit sprites clipped to their boundaries (not plain circles)
- [ ] Mobile collision shapes match the fruit silhouettes (convex hull, not circles)
- [ ] Fruits that escape the play area on mobile are detected and removed
- [ ] No regression on web
- [ ] Existing tests pass; add mobile-specific test coverage if applicable

## Labels

`bug`, `mobile`, `cascade`
