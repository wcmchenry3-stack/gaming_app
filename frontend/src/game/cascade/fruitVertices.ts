import fruitVerticesRaw from "../../../assets/fruit-vertices.json";
import cosmosVerticesRaw from "../../../assets/cosmos-vertices.json";

export type VertexPoint = { x: number; y: number };

/** Sprite rendering info for aligning the image with the collision hull. */
export interface SpriteInfo {
  /** Offset from body centre to image centre, in normalised coords (multiply by radius). */
  offsetX: number;
  offsetY: number;
  /** Half-size of the image in normalised coords (multiply by radius). */
  scaleX: number;
  scaleY: number;
}

interface AssetEntry {
  verts: [number, number][];
  spriteOffset: [number, number];
  spriteScale: [number, number];
}

/**
 * Perpendicular distance from point P to the line segment A→B.
 */
function perpendicularDist(p: VertexPoint, a: VertexPoint, b: VertexPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
}

/**
 * Ramer-Douglas-Peucker simplification for a closed polygon.
 *
 * Iteratively increases epsilon until the result has at most maxCount
 * vertices. Much better than uniform downsampling at preserving shape
 * features (corners, concavities) while reducing vertex count.
 */
function simplifyVertices(verts: VertexPoint[], maxCount: number): VertexPoint[] {
  if (verts.length <= maxCount) return verts;

  function rdp(points: VertexPoint[], epsilon: number): VertexPoint[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDist(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      const left = rdp(points.slice(0, maxIdx + 1), epsilon);
      const right = rdp(points.slice(maxIdx), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  // Close the polygon for RDP, then remove duplicate closing vertex
  const closed = [...verts, verts[0]];

  // Binary search for the smallest epsilon that yields ≤ maxCount vertices
  let lo = 0;
  let hi = 2.0; // vertices are in [-1, 1] range, so 2.0 is generous
  let best = verts;

  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const result = rdp(closed, mid);
    const trimmed = result.slice(0, -1); // remove closing duplicate
    if (trimmed.length <= maxCount) {
      best = trimmed;
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return best;
}

function getEntry(setId: string, nameKey: string): AssetEntry | null {
  let map: Record<string, AssetEntry> | null = null;
  if (setId === "fruits") map = fruitVerticesRaw as unknown as Record<string, AssetEntry>;
  else if (setId === "cosmos") map = cosmosVerticesRaw as unknown as Record<string, AssetEntry>;
  else return null;

  return map[nameKey] ?? null;
}

/**
 * Return normalized convex-hull vertices for a fruit, or null if the set
 * has no PNG assets or fewer than 3 vertices were extracted.
 *
 * Vertices are centred on the opaque bounding-box centre and scaled so the
 * hull fills [-1, 1]. Multiply each component by def.radius for world-space.
 */
export function getVerticesForFruit(setId: string, nameKey: string): VertexPoint[] | null {
  const entry = getEntry(setId, nameKey);
  if (!entry) return null;

  const raw = entry.verts;
  if (!raw || raw.length < 3) return null;
  return simplifyVertices(
    raw.map(([x, y]) => ({ x, y })),
    24
  );
}

/**
 * Minimum circular clip radius (px) that fully encompasses the sprite rect.
 *
 * The sprite is drawn as an axis-aligned rectangle centred at
 * (offsetX, offsetY)*r with half-extents (scaleX, scaleY)*r. For most
 * planets this equals `sqrt(2)*scaleX*r`; for ringed planets (Uranus,
 * Saturn) whose rings push the image beyond the physics radius, this
 * returns a value larger than `r` so the ring imagery is not clipped.
 *
 * Physics collision always uses the unmodified `r` — this is render-only.
 */
export function spriteClipRadius(sprite: SpriteInfo, r: number): number {
  const { offsetX: ox, offsetY: oy, scaleX: sx, scaleY: sy } = sprite;
  // Distance from origin to each corner of the sprite bounding rect
  return (
    Math.max(
      Math.hypot(ox + sx, oy + sy),
      Math.hypot(ox - sx, oy + sy),
      Math.hypot(ox + sx, oy - sy),
      Math.hypot(ox - sx, oy - sy)
    ) * r
  );
}

/**
 * Return sprite rendering info so the image aligns with the collision hull.
 * Returns null for sets without PNG assets.
 */
export function getSpriteInfo(setId: string, nameKey: string): SpriteInfo | null {
  const entry = getEntry(setId, nameKey);
  if (!entry) return null;

  return {
    offsetX: entry.spriteOffset[0],
    offsetY: entry.spriteOffset[1],
    scaleX: entry.spriteScale[0],
    scaleY: entry.spriteScale[1],
  };
}
