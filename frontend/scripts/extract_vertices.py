#!/usr/bin/env python3
"""
extract_vertices.py
===================
Extract convex-hull polygon vertices from processed PNG sprite assets.

The output JSON is used at runtime by the cascade physics engine to create
polygon-shaped Matter.js bodies that match the actual fruit/planet outlines,
replacing the previous circle-only approach.

Usage
-----
  python scripts/extract_vertices.py            # process both default asset dirs
  python scripts/extract_vertices.py <path>     # single PNG (prints to stdout)
                                                 # or directory (writes adjacent JSON)

Output
------
  frontend/assets/fruit-vertices.json     — keys = fruit PNG filename stems
  frontend/assets/planet-vertices.json    — keys = celestial PNG filename stems

JSON format
-----------
  { "cherry": [[-0.12, 0.95], [0.38, 0.82], ...], "apple": [...], ... }

Each vertex array is the convex hull of the opaque pixels, normalized so that:
  - area-weighted centroid = (0, 0)  ← matches Matter.js Vertices.centre
  - max distance from centroid = 1.0

Scale by the fruit's physics radius at runtime to get world-space vertices.

Algorithm
---------
1. Load PNG as RGBA via Pillow.
2. Collect all pixels with alpha > 128 (the opaque fruit pixels).
3. Compute the convex hull (scipy.spatial.ConvexHull if available, else
   Graham scan implemented inline with no extra dependencies).
4. Normalize: subtract centroid, scale so max_dist = 1.0.
5. Store as list of [x, y] float pairs, rounded to 6 decimal places.
"""

import json
import math
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_FRONTEND_DIR = _SCRIPT_DIR.parent
_ASSETS_DIR = _FRONTEND_DIR / "assets"

DEFAULT_TARGETS = [
    (_ASSETS_DIR / "fruit-icons", _ASSETS_DIR / "fruit-vertices.json"),
    (_ASSETS_DIR / "celestial-icons", _ASSETS_DIR / "planet-vertices.json"),
]


# ---------------------------------------------------------------------------
# Core algorithm (pure functions — no file I/O — tested independently)
# ---------------------------------------------------------------------------

def _opaque_pixels(
    pixels: list[tuple[int, int, int, int]],
    width: int,
    height: int,
    alpha_threshold: int = 128,
) -> list[tuple[int, int]]:
    """Return (x, y) coordinates of every pixel whose alpha > alpha_threshold."""
    result = []
    for idx, px in enumerate(pixels):
        if px[3] > alpha_threshold:
            x = idx % width
            y = idx // width
            result.append((x, y))
    return result


def _cross(o: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    """2-D cross product of vectors OA and OB."""
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _graham_scan(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """
    Compute the convex hull of *points* using a Graham scan.

    Returns the hull vertices in counter-clockwise order.
    Collinear points on the hull boundary are excluded (strict left turns only).

    Returns [] for fewer than 3 non-collinear points.
    """
    pts = list(set(points))  # deduplicate
    if len(pts) < 3:
        return []

    # Pivot: lowest y, then leftmost x
    pivot = min(pts, key=lambda p: (p[1], p[0]))

    def polar_key(p: tuple[float, float]) -> tuple[float, float]:
        dx = p[0] - pivot[0]
        dy = p[1] - pivot[1]
        return (math.atan2(dy, dx), dx * dx + dy * dy)

    sorted_pts = sorted([p for p in pts if p != pivot], key=polar_key)

    stack: list[tuple[float, float]] = [pivot]
    for p in sorted_pts:
        while len(stack) >= 2 and _cross(stack[-2], stack[-1], p) <= 0:
            stack.pop()
        stack.append(p)

    return stack if len(stack) >= 3 else []


def _area_centroid(hull: list[tuple[float, float]]) -> tuple[float, float]:
    """
    Compute the area-weighted (polygon) centroid of a convex hull.

    Uses the standard shoelace formula — the same method Matter.js uses
    internally in Vertices.centre().  For symmetric shapes the result equals
    the arithmetic mean; for asymmetric shapes (grapes, cherry, apple, …) it
    can differ significantly.

    Falls back to the arithmetic mean for degenerate cases (near-zero area).
    """
    n = len(hull)
    area = cx = cy = 0.0
    for i in range(n):
        j = (i + 1) % n
        cross = hull[i][0] * hull[j][1] - hull[j][0] * hull[i][1]
        area += cross
        cx += (hull[i][0] + hull[j][0]) * cross
        cy += (hull[i][1] + hull[j][1]) * cross
    area /= 2.0
    if abs(area) < 1e-10:
        # Degenerate polygon — fall back to arithmetic mean
        return sum(p[0] for p in hull) / n, sum(p[1] for p in hull) / n
    return cx / (6 * area), cy / (6 * area)


def _normalize_hull(
    hull: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """
    Normalize hull vertices so that:
      - area-weighted centroid is at (0, 0)  ← matches Matter.js Vertices.centre
      - maximum distance from centroid is 1.0

    Using the area-weighted centroid (rather than the arithmetic mean) ensures
    that when Matter.js calls setVertices() internally during fromVertices(),
    its own centroid recentering is a no-op — the body ends up exactly at the
    requested spawn position regardless of shape asymmetry.

    Returns [] if hull is empty or all vertices are coincident.
    """
    if not hull:
        return []

    cx, cy = _area_centroid(hull)

    centered = [(p[0] - cx, p[1] - cy) for p in hull]

    max_dist = max(math.hypot(p[0], p[1]) for p in centered)
    if max_dist < 1e-9:
        return []

    return [(p[0] / max_dist, p[1] / max_dist) for p in centered]


def extract_hull(
    pixels: list[tuple[int, int, int, int]],
    width: int,
    height: int,
) -> list[tuple[float, float]]:
    """
    Extract a normalized convex hull from a flat RGBA pixel list.

    Returns a list of (x, y) float tuples (centroid at origin, max radius = 1.0),
    or [] if there are fewer than 3 opaque pixels.
    """
    opaque = _opaque_pixels(pixels, width, height)
    if len(opaque) < 3:
        return []

    # Use scipy if available for a faster/more robust hull
    try:
        from scipy.spatial import ConvexHull  # type: ignore

        import numpy as np  # type: ignore

        arr = np.array(opaque, dtype=float)
        hull_obj = ConvexHull(arr)
        hull_pts = [tuple(arr[i]) for i in hull_obj.vertices]
    except ImportError:
        hull_pts = _graham_scan([(float(x), float(y)) for x, y in opaque])

    return _normalize_hull(hull_pts)


# ---------------------------------------------------------------------------
# File I/O helpers
# ---------------------------------------------------------------------------

def _load_rgba(path: Path) -> tuple[list[tuple[int, int, int, int]], int, int]:
    """Load a PNG as an RGBA flat pixel list via Pillow."""
    try:
        from PIL import Image  # type: ignore
    except ImportError as exc:
        raise SystemExit("Pillow is required: pip install Pillow") from exc

    img = Image.open(path).convert("RGBA")
    width, height = img.size
    raw = list(img.get_flattened_data())
    return raw, width, height


# ---------------------------------------------------------------------------
# Directory and file processing
# ---------------------------------------------------------------------------

def process_directory(
    png_dir: Path,
    output_json: Path,
) -> dict[str, list[list[float]]]:
    """
    Process all PNGs in *png_dir*, write results to *output_json*.

    Returns the vertex map written.
    """
    result: dict[str, list[list[float]]] = {}

    for png_path in sorted(png_dir.glob("*.png")):
        pixels, width, height = _load_rgba(png_path)
        hull = extract_hull(pixels, width, height)
        key = png_path.stem  # filename without extension
        result[key] = [[round(x, 6), round(y, 6)] for x, y in hull]
        status = f"{len(hull)} vertices" if hull else "no hull (too few opaque pixels)"
        print(f"  {png_path.name}: {status}")

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Written to {output_json.relative_to(_FRONTEND_DIR)}")
    return result


def process_single_file(path: Path) -> None:
    """Process a single PNG and print the vertex JSON to stdout."""
    pixels, width, height = _load_rgba(path)
    hull = extract_hull(pixels, width, height)
    result = {path.stem: [[round(x, 6), round(y, 6)] for x, y in hull]}
    print(json.dumps(result, indent=2))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) > 1:
        target = Path(sys.argv[1])
        if not target.exists():
            print(f"Path not found: {target}", file=sys.stderr)
            sys.exit(1)
        if target.is_file():
            if target.suffix.lower() != ".png":
                print(f"Expected a PNG file, got: {target}", file=sys.stderr)
                sys.exit(1)
            process_single_file(target)
        else:
            # Directory — write JSON next to it
            output_json = target.parent / f"{target.name}-vertices.json"
            process_directory(target, output_json)
    else:
        for png_dir, output_json in DEFAULT_TARGETS:
            print(f"\nProcessing {png_dir.name}/")
            process_directory(png_dir, output_json)


if __name__ == "__main__":
    main()
