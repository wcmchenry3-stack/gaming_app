# Asset Management

## Source art originals

`frontend/assets/source-icons/` is **not in the repo**. It contains the original high-resolution PNGs (163 MB: ~86 MB cosmos, ~77 MB fruits) used to generate the optimised WebP/PNG sprites.

**Location:** Google Drive → `bc-arcade` folder  
**Link:** https://drive.google.com/drive/folders/1LW97pBFsqfG67bQKvQwkhMlLBswzIVhm

Download and place at `frontend/assets/source-icons/` if you need to re-export art at a different resolution.

## Asset conventions

See `CLAUDE.md` for the full conventions. Summary:

| Directory | Format | Purpose |
|---|---|---|
| `assets/sounds/` | MP3 / OGG | All game audio — registered in `_shared/sounds.ts` |
| `assets/images/shared/` | WebP | Art reused across ≥2 games (fruit icons, celestial icons) |
| `assets/images/<game>/` | WebP / PNG | Game-specific sprites |
| `assets/<game>/` (legacy) | mixed | Existing per-game dirs — migrate on next touch |

New games: add sounds to `_shared/sounds.ts` and images to `assets/images/<game>/`.
