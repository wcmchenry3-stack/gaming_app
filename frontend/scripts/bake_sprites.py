#!/usr/bin/env python3
"""
Pre-bake sprite pipeline for Cascade game assets.

For each asset in both fruit themes, this script:
  1. Loads the processed PNG
  2. Zeroes semi-transparent pixels (moves cleanImage logic offline)
  3. Applies sprite offset/scale to centre the asset on a transparent canvas
  4. Clips to the spriteClipRadius circle
  5. Saves a 512×512 baked PNG — ready for a single ctx.drawImage at runtime

Also writes `bakedClipR` (normalised: clipR / radius) into each theme's
vertices JSON so the runtime renderer knows the draw half-size:

    const clipR = def.bakedClipR * def.radius;   // half-size in world px
    ctx.drawImage(baked, -clipR, -clipR, clipR*2, clipR*2);

Run from anywhere:
    python frontend/scripts/bake_sprites.py

Requires Pillow:
    pip install Pillow
"""
import json
import math
import pathlib

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError:
    raise SystemExit("Pillow is required: pip install Pillow")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
FRONTEND_DIR = SCRIPT_DIR.parent
ASSETS_DIR = FRONTEND_DIR / "assets"

# Output canvas: 512×512.  The baked clipR circle fills the entire image.
# At runtime: ctx.drawImage(baked, cx-clipR, cy-clipR, clipR*2, clipR*2)
HALF = 256  # half-size of each baked PNG (pixels)

THEMES = [
    {
        "id": "fruits",
        "icon_dir": ASSETS_DIR / "fruit-icons",
        "vertices_json": ASSETS_DIR / "fruit-vertices.json",
        "out_dir": ASSETS_DIR / "fruits-baked",
    },
    {
        "id": "cosmos",
        "icon_dir": ASSETS_DIR / "celestial-icons",
        "vertices_json": ASSETS_DIR / "cosmos-vertices.json",
        "out_dir": ASSETS_DIR / "cosmos-baked",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_image(img: Image.Image) -> Image.Image:
    """Zero RGBA for pixels with alpha < 200 — mirrors runtime cleanImage().

    Scrubs JPEG compression halos and semi-transparent fringe so baked edges
    stay crisp.  The saturn/uranus ring body pixels are fully opaque (alpha
    255) and survive this threshold; only their feathered anti-alias edge
    pixels are zeroed, which is acceptable.
    """
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 200:
                pixels[x, y] = (0, 0, 0, 0)
    return img


def sprite_clip_radius_norm(sprite: dict) -> float:
    """
    Normalised spriteClipRadius (= clipR / r).

    Mirrors the JavaScript spriteClipRadius() in the asset preview tool:
      max(hypot(ox+sx, oy+sy), hypot(ox-sx, oy+sy),
          hypot(ox+sx, oy-sy), hypot(ox-sx, oy-sy))
    """
    ox, oy = sprite["spriteOffset"]
    sx, sy = sprite["spriteScale"]
    return max(
        math.hypot(ox + sx, oy + sy),
        math.hypot(ox - sx, oy + sy),
        math.hypot(ox + sx, oy - sy),
        math.hypot(ox - sx, oy - sy),
    )


def bake_asset(src_png: pathlib.Path, sprite: dict, out_png: pathlib.Path) -> float:
    """
    Bake one asset PNG.

    Returns normalised bakedClipR (= clipR / r) so the caller can store it in
    the vertices JSON.
    """
    ox, oy = sprite["spriteOffset"]
    sx, sy = sprite["spriteScale"]
    clip_r_norm = sprite_clip_radius_norm(sprite)

    out_size = HALF * 2  # 512

    # Scale factor: HALF pixels = 1 normalised unit of clipR.
    # So the baked clipR circle exactly fills the 512×512 canvas.
    scale = HALF / clip_r_norm

    # 1. Load + clean source image
    src = Image.open(src_png).convert("RGBA")
    src = clean_image(src)

    # 2. Compute where the sprite sits in the output canvas.
    #    Canvas centre = (HALF, HALF).
    #    In normalised units: sprite rect is
    #      x ∈ [ox - sx, ox + sx], y ∈ [oy - sy, oy + sy]
    sprite_x = (ox - sx) * scale + HALF
    sprite_y = (oy - sy) * scale + HALF
    sprite_w = 2 * sx * scale
    sprite_h = 2 * sy * scale

    # 3. Composite sprite onto a transparent canvas
    canvas = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    resized = src.resize(
        (max(1, round(sprite_w)), max(1, round(sprite_h))),
        Image.LANCZOS,
    )
    # PIL paste handles negative/out-of-bounds coordinates correctly
    canvas.paste(resized, (round(sprite_x), round(sprite_y)), resized)

    # 4. Intersect existing alpha with physics-circle clip mask.
    #    The physics radius (r=1.0 normalised) maps to HALF/clip_r_norm pixels
    #    in the baked canvas.  Clipping here guarantees no colour bleeds
    #    outside the collision boundary at runtime, regardless of how the
    #    sprite is positioned or how large the source image is.
    physics_r_px = HALF / clip_r_norm  # pixels that correspond to r=1.0
    cx = cy = HALF  # canvas centre
    circle_mask = Image.new("L", (out_size, out_size), 0)
    ImageDraw.Draw(circle_mask).ellipse(
        [cx - physics_r_px, cy - physics_r_px, cx + physics_r_px, cy + physics_r_px],
        fill=255,
    )
    existing_alpha = canvas.split()[3]
    combined_alpha = ImageChops.multiply(existing_alpha, circle_mask)
    canvas.putalpha(combined_alpha)

    # 5. Save
    out_png.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_png, "PNG")
    return clip_r_norm


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    for theme in THEMES:
        print(f"\n=== {theme['id']} ===")
        vertices: dict = json.loads(theme["vertices_json"].read_text())
        baked_clip_r: dict[str, float] = {}

        for name, sprite in vertices.items():
            src_png: pathlib.Path = theme["icon_dir"] / f"{name}.png"
            if not src_png.exists():
                print(f"  SKIP  {name}: {src_png} not found")
                continue

            out_png: pathlib.Path = theme["out_dir"] / f"{name}.png"
            clip_r = bake_asset(src_png, sprite, out_png)
            baked_clip_r[name] = clip_r
            print(f"  BAKED {name}: bakedClipR={clip_r:.6f}")

        # Write bakedClipR into each entry of the vertices JSON, then
        # format with Prettier so CI doesn't complain about code style.
        for name, clip_r in baked_clip_r.items():
            vertices[name]["bakedClipR"] = round(clip_r, 6)
        theme["vertices_json"].write_text(json.dumps(vertices, indent=2) + "\n")
        _prettier(theme["vertices_json"])
        print(f"  Updated {theme['vertices_json'].name}")

    print("\nDone. Commit the baked PNGs and updated vertices JSON files.")
    print("Then update fruitSets.ts with the bakedClipR values and bakedIcon imports.")


def _prettier(path: pathlib.Path) -> None:
    """Run 'npx prettier --write' on path if npx is available; silently skip if not."""
    import shutil
    import subprocess

    npx = shutil.which("npx")
    if not npx:
        print(f"  (npx not found — run: npx prettier --write {path.name})")
        return
    result = subprocess.run(
        [npx, "prettier", "--write", str(path)],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  (prettier failed: {result.stderr.strip()!r})")


if __name__ == "__main__":
    main()
