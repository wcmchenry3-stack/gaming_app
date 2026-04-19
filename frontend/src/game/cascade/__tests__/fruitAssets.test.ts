/**
 * Integration tests for fruit collision assets.
 *
 * Validates that the generated vertex JSON files are consistent with
 * the fruit set definitions in fruitSets.ts. These tests use the REAL
 * asset data (not mocked) to catch regressions in the extraction pipeline.
 */

import fruitVerticesRaw from "../../../../assets/fruit-vertices.json";
import cosmosVerticesRaw from "../../../../assets/cosmos-vertices.json";
import { FRUIT_SETS, FruitSet, FruitDefinition } from "../../../theme/fruitSets";

function requireFruitSet(id: string): FruitSet {
  const fs = FRUIT_SETS[id];
  if (fs === undefined) throw new Error(`FruitSet '${id}' not found`);
  return fs;
}
import { getVerticesForFruit, getSpriteInfo } from "../fruitVertices";

interface AssetEntry {
  verts: [number, number][];
  spriteOffset: [number, number];
  spriteScale: [number, number];
}

function nameKeyFor(def: FruitDefinition): string {
  return (def as { nameKey?: string }).nameKey ?? def.name.toLowerCase();
}

// ---------------------------------------------------------------------------
// Fruit set — vertex data existence
// ---------------------------------------------------------------------------

describe("fruit vertex data completeness", () => {
  const fruitSet = requireFruitSet("fruits");
  const fruitMap = fruitVerticesRaw as unknown as Record<string, AssetEntry>;

  it("has vertex data for every fruit tier", () => {
    for (const def of fruitSet.fruits) {
      if (!def.icon) continue; // skip emoji-only entries
      const key = nameKeyFor(def);
      expect(fruitMap[key]).toBeDefined();
      expect(fruitMap[key]?.verts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("has spriteOffset and spriteScale for every fruit", () => {
    for (const def of fruitSet.fruits) {
      if (!def.icon) continue;
      const key = nameKeyFor(def);
      const entry = fruitMap[key];
      if (entry === undefined) throw new Error(`Missing vertex entry for key: ${key}`);
      expect(entry.spriteOffset).toHaveLength(2);
      expect(entry.spriteScale).toHaveLength(2);
      expect(entry.spriteScale[0]).toBeGreaterThan(0);
      expect(entry.spriteScale[1]).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Fruit set — vertex quality
// ---------------------------------------------------------------------------

describe("fruit vertex quality", () => {
  const fruitSet = requireFruitSet("fruits");

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — hull fills at least 60%% of [-1,1] range",
    (key) => {
      const verts = getVerticesForFruit("fruits", key);
      expect(verts).not.toBeNull();
      const xs = verts!.map((v) => v.x);
      const ys = verts!.map((v) => v.y);
      const xRange = Math.max(...xs) - Math.min(...xs);
      const yRange = Math.max(...ys) - Math.min(...ys);
      // Hull should fill a reasonable portion of the normalised space
      expect(Math.max(xRange, yRange)).toBeGreaterThanOrEqual(1.2);
    }
  );

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — vertices stay within [-1,1] bounds",
    (key) => {
      const verts = getVerticesForFruit("fruits", key);
      expect(verts).not.toBeNull();
      for (const pt of verts!) {
        expect(pt.x).toBeGreaterThanOrEqual(-1.0 - 0.01);
        expect(pt.x).toBeLessThanOrEqual(1.0 + 0.01);
        expect(pt.y).toBeGreaterThanOrEqual(-1.0 - 0.01);
        expect(pt.y).toBeLessThanOrEqual(1.0 + 0.01);
      }
    }
  );

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — simplifies to ≤ 24 vertices",
    (key) => {
      const verts = getVerticesForFruit("fruits", key);
      expect(verts).not.toBeNull();
      expect(verts!.length).toBeLessThanOrEqual(24);
      expect(verts!.length).toBeGreaterThanOrEqual(3);
    }
  );

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — hull centre is near origin (no large offset)",
    (key) => {
      const verts = getVerticesForFruit("fruits", key);
      expect(verts).not.toBeNull();
      const cx = verts!.reduce((s, v) => s + v.x, 0) / verts!.length;
      const cy = verts!.reduce((s, v) => s + v.y, 0) / verts!.length;
      // Arithmetic centre should be within 0.4 of origin
      expect(Math.abs(cx)).toBeLessThan(0.4);
      expect(Math.abs(cy)).toBeLessThan(0.4);
    }
  );
});

// ---------------------------------------------------------------------------
// Fruit set — sprite alignment
// ---------------------------------------------------------------------------

describe("fruit sprite alignment", () => {
  const fruitSet = requireFruitSet("fruits");

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — spriteScale is reasonable (0.8–3.0)",
    (key) => {
      const info = getSpriteInfo("fruits", key);
      expect(info).not.toBeNull();
      // Scale shouldn't be too small (content would be tiny) or too large (extreme zoom)
      expect(info!.scaleX).toBeGreaterThanOrEqual(0.8);
      expect(info!.scaleX).toBeLessThanOrEqual(3.0);
      expect(info!.scaleY).toBeGreaterThanOrEqual(0.8);
      expect(info!.scaleY).toBeLessThanOrEqual(3.0);
    }
  );

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — spriteOffset is not extreme (< 1.0)",
    (key) => {
      const info = getSpriteInfo("fruits", key);
      expect(info).not.toBeNull();
      expect(Math.abs(info!.offsetX)).toBeLessThan(1.0);
      expect(Math.abs(info!.offsetY)).toBeLessThan(1.0);
    }
  );
});

// ---------------------------------------------------------------------------
// Polygon validity — no self-intersections, correct winding
// ---------------------------------------------------------------------------

describe("fruit hull polygon validity", () => {
  const fruitSet = requireFruitSet("fruits");

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — polygon has non-zero area (not degenerate)",
    (key) => {
      const verts = getVerticesForFruit("fruits", key);
      expect(verts).not.toBeNull();
      // Shoelace formula for polygon area
      let area = 0;
      const n = verts!.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area +=
          (verts![i]?.x ?? 0) * (verts![j]?.y ?? 0) - (verts![j]?.x ?? 0) * (verts![i]?.y ?? 0);
      }
      area = Math.abs(area) / 2;
      // Area should be meaningful (> 0.1 in normalised space)
      expect(area).toBeGreaterThan(0.1);
    }
  );

  it.each(fruitSet.fruits.filter((d) => d.icon).map((d) => [nameKeyFor(d), d.name] as const))(
    "%s (%s) — no duplicate adjacent vertices",
    (key) => {
      const verts = getVerticesForFruit("fruits", key);
      expect(verts).not.toBeNull();
      for (let i = 0; i < verts!.length; i++) {
        const j = (i + 1) % verts!.length;
        const dist = Math.hypot(
          (verts![i]?.x ?? 0) - (verts![j]?.x ?? 0),
          (verts![i]?.y ?? 0) - (verts![j]?.y ?? 0)
        );
        expect(dist).toBeGreaterThan(0.001);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Visual tier progression — each tier must appear ≥10% larger than the previous
// ---------------------------------------------------------------------------

describe("cosmos visual tier progression", () => {
  it("each cosmos tier shows ≥10% visual size growth over the previous tier", () => {
    const cosmosMap = cosmosVerticesRaw as unknown as Record<string, AssetEntry>;
    const fruits = requireFruitSet("cosmos").fruits;
    const sorted = [...fruits].sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const prevKey = nameKeyFor(prev);
      const currKey = nameKeyFor(curr);
      const prevScale = cosmosMap[prevKey]?.spriteScale[0] ?? 1;
      const currScale = cosmosMap[currKey]?.spriteScale[0] ?? 1;
      const prevVis = prev.radius * prevScale;
      const currVis = curr.radius * currScale;
      const growth = (currVis - prevVis) / prevVis;
      expect(growth).toBeGreaterThanOrEqual(
        0.1,
        `T${prev.tier} ${prev.name} → T${curr.tier} ${curr.name}: visual growth ${(growth * 100).toFixed(1)}% < 10%`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-check: fruitSets nameKey matches vertex JSON keys
// ---------------------------------------------------------------------------

describe("fruitSets ↔ vertex JSON key alignment", () => {
  it("every fruit with an icon has a matching vertex JSON entry", () => {
    const fruitMap = fruitVerticesRaw as unknown as Record<string, AssetEntry>;
    for (const def of requireFruitSet("fruits").fruits) {
      if (!def.icon) continue;
      const key = nameKeyFor(def);
      expect(fruitMap).toHaveProperty(key);
    }
  });

  it("every cosmos entry with an icon has a matching vertex JSON entry", () => {
    const cosmosMap = cosmosVerticesRaw as unknown as Record<string, AssetEntry>;
    for (const def of requireFruitSet("cosmos").fruits) {
      if (!def.icon) continue;
      const key = nameKeyFor(def);
      expect(cosmosMap).toHaveProperty(key);
    }
  });
});
