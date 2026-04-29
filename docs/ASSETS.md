# Asset Management

## Source art originals

`frontend/assets/source-icons/` is **not in the repo**. It contains the original high-resolution PNGs (163 MB: ~86 MB cosmos, ~77 MB fruits) used to generate the optimised WebP/PNG sprites.

**Location:** Google Drive → `bc-arcade` folder  
**Link:** https://drive.google.com/drive/folders/1LW97pBFsqfG67bQKvQwkhMlLBswzIVhm

Download and place at `frontend/assets/source-icons/` if you need to re-export art at a different resolution.

## Asset conventions

| Directory | Format | Purpose | Registry |
|---|---|---|---|
| `assets/sounds/` | MP3 / OGG | All game audio | `_shared/sounds.ts` |
| `assets/fruit-icons/` | WebP | Fruit art for React Native UI (menus, pickers) | `_shared/images.ts` → `FRUIT_ICONS` |
| `assets/fruits-baked/` | PNG | Pre-composited fruit sprites for Skia canvas | `_shared/images.ts` → `FRUIT_BAKED` |
| `assets/celestial-icons/` | WebP | Cosmos art for React Native UI | `_shared/images.ts` → `COSMOS_ICONS` |
| `assets/cosmos-baked/` | PNG | Pre-composited cosmos sprites for Skia canvas | `_shared/images.ts` → `COSMOS_BAKED` |
| `assets/<game>/` | WebP / PNG | Game-specific sprites (e.g. `starswarm/`) | Per-game `assets.ts` |

**Why two formats per theme?** `icons` (WebP) are transparent-background images used in React Native `<Image>` components. `baked` (PNG) are pre-composited, clipped sprites for single-call Skia `drawImage` — produced by `scripts/bake_sprites.py`. They are different assets, not duplicates.

**Adding a new shared image set:** add imports + export object to `_shared/images.ts`; import the registry object wherever needed.

**Adding a new game's sprites:** create `assets/<game>/` and a `src/game/<game>/assets.ts` loader (see `starswarm/assets.ts` as the pattern).
