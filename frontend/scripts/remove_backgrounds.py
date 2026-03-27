#!/usr/bin/env python3
"""
remove-backgrounds.py
=====================
Remove baked-in opaque backgrounds from PNG sprite assets.

Usage
-----
  python scripts/remove-backgrounds.py            # process both default asset dirs
  python scripts/remove-backgrounds.py <path>     # single file or directory

Algorithm
---------
1. Sample the background colour from 3×3 pixel regions at each of the four
   corners separately, producing up to four reference colours.
2. For every pixel compute the Euclidean RGB distance to the NEAREST corner
   reference.  This handles images where the background colour isn't uniform
   (e.g. gray-white in three corners but pure-white in the fourth).
3. Apply a two-threshold alpha fade using that minimum distance:
     dist < HARD_THRESHOLD  → alpha = 0   (definitely background)
     dist < SOFT_THRESHOLD  → alpha lerped 0→original (anti-aliased edge)
     dist >= SOFT_THRESHOLD → alpha unchanged (definitely foreground)

The script is *idempotent*: if any corner pixel already has alpha < 200 the
file is assumed to have already been processed and is skipped.
"""

import math
import sys
from pathlib import Path

HARD_THRESHOLD = 25  # pixels closer than this to background → fully transparent
SOFT_THRESHOLD = 80  # pixels beyond this from background → fully opaque

# Default asset directories (relative to this script's parent / frontend root)
_SCRIPT_DIR = Path(__file__).resolve().parent
_FRONTEND_DIR = _SCRIPT_DIR.parent
DEFAULT_DIRS = [
    _FRONTEND_DIR / "assets" / "fruit-icons",
    _FRONTEND_DIR / "assets" / "celestial-icons",
]


# ---------------------------------------------------------------------------
# Core algorithm (operates on raw RGBA pixel lists for testability)
# ---------------------------------------------------------------------------

def _sample_background(pixels: list[tuple[int, int, int, int]], width: int, height: int) -> list[tuple[float, float, float]]:
    """
    Return one average RGB colour per corner (top-left, top-right, bottom-left,
    bottom-right), each averaged over a 3×3 pixel sample region.

    Using per-corner references rather than a single global average handles
    images where the background colour varies across the image (e.g. one corner
    is gray-white while another is pure white).
    """
    sample_size = min(3, width, height)
    result = []
    for row_start in (0, height - sample_size):
        for col_start in (0, width - sample_size):
            samples = []
            for r in range(row_start, row_start + sample_size):
                for c in range(col_start, col_start + sample_size):
                    px = pixels[r * width + c]
                    samples.append(px[:3])
            avg_r = sum(p[0] for p in samples) / len(samples)
            avg_g = sum(p[1] for p in samples) / len(samples)
            avg_b = sum(p[2] for p in samples) / len(samples)
            result.append((avg_r, avg_g, avg_b))
    return result


def _is_already_transparent(pixels: list[tuple[int, int, int, int]], width: int, height: int) -> bool:
    """Return True if any corner pixel already has alpha < 200 (already processed)."""
    sample_size = min(3, width, height)
    for row_start in (0, height - sample_size):
        for col_start in (0, width - sample_size):
            for r in range(row_start, row_start + sample_size):
                for c in range(col_start, col_start + sample_size):
                    if pixels[r * width + c][3] < 200:
                        return True
    return False


def remove_background(
    pixels: list[tuple[int, int, int, int]],
    width: int,
    height: int,
    hard_threshold: int = HARD_THRESHOLD,
    soft_threshold: int = SOFT_THRESHOLD,
) -> list[tuple[int, int, int, int]]:
    """
    Return a new pixel list with background pixels made transparent.

    Parameters
    ----------
    pixels:          flat list of (R, G, B, A) tuples, row-major
    width, height:   image dimensions
    hard_threshold:  pixels within this Euclidean distance of background → alpha 0
    soft_threshold:  pixels beyond this distance from background → alpha unchanged

    Returns
    -------
    New flat list of (R, G, B, A) with modified alpha values.
    """
    bg_refs = _sample_background(pixels, width, height)
    soft_range = soft_threshold - hard_threshold
    result = []
    for r, g, b, a in pixels:
        dist = min(
            math.sqrt((r - bg_r) ** 2 + (g - bg_g) ** 2 + (b - bg_b) ** 2)
            for bg_r, bg_g, bg_b in bg_refs
        )
        if dist < hard_threshold:
            result.append((r, g, b, 0))
        elif dist < soft_threshold:
            t = (dist - hard_threshold) / soft_range
            new_a = int(round(a * t))
            result.append((r, g, b, new_a))
        else:
            result.append((r, g, b, a))
    return result


# ---------------------------------------------------------------------------
# File I/O helpers
# ---------------------------------------------------------------------------

def _load_rgba(path: Path) -> tuple[list[tuple[int, int, int, int]], int, int]:
    """Load a PNG as RGBA pixel list using Pillow."""
    try:
        from PIL import Image  # type: ignore
    except ImportError as exc:
        raise SystemExit("Pillow is required: pip install Pillow") from exc

    img = Image.open(path).convert("RGBA")
    width, height = img.size
    raw = list(img.get_flattened_data())
    return raw, width, height


def _save_rgba(path: Path, pixels: list[tuple[int, int, int, int]], width: int, height: int) -> None:
    """Save pixel list back to PNG via Pillow."""
    from PIL import Image  # type: ignore

    img = Image.new("RGBA", (width, height))
    img.putdata(pixels)
    img.save(path, format="PNG")


# ---------------------------------------------------------------------------
# File-level processing
# ---------------------------------------------------------------------------

def process_file(path: Path) -> str:
    """
    Process a single PNG file in place.

    Returns a human-readable status string.
    """
    pixels, width, height = _load_rgba(path)

    if _is_already_transparent(pixels, width, height):
        return f"{path.name} — skipped (already transparent)"

    processed = remove_background(pixels, width, height)

    cleared = sum(1 for orig, new in zip(pixels, processed) if orig[3] > 0 and new[3] == 0)
    pct = cleared / (width * height) * 100

    _save_rgba(path, processed, width, height)
    return f"{path.name} — {pct:.1f}% pixels cleared"


def process_path(target: Path) -> list[str]:
    """Process a single file or all PNGs in a directory. Returns status lines."""
    if target.is_file():
        if target.suffix.lower() != ".png":
            return [f"Skipped (not a PNG): {target}"]
        return [process_file(target)]

    if target.is_dir():
        pngs = sorted(target.glob("*.png"))
        if not pngs:
            return [f"No PNG files found in {target}"]
        return [process_file(p) for p in pngs]

    return [f"Path not found: {target}"]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    targets = [Path(arg) for arg in sys.argv[1:]] if len(sys.argv) > 1 else DEFAULT_DIRS

    all_results = []
    for target in targets:
        all_results.extend(process_path(target))

    for line in all_results:
        print(line)


if __name__ == "__main__":
    main()
