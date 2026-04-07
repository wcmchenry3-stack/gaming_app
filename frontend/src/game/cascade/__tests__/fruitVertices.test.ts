/**
 * Tests for fruitVertices.ts — the runtime vertex lookup module.
 *
 * Both JSON imports are mocked so the tests do not depend on the generated
 * asset files being present in the repo, and run instantly.
 */

const entry = (verts: [number, number][]) => ({
  verts,
  spriteOffset: [0, 0],
  spriteScale: [1, 1],
});

jest.mock("../../../../assets/fruit-vertices.json", () => ({
  cherry: entry([
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ]),
  grapes: entry([
    [-0.4, -0.6],
    [0.4, -0.6],
    [0.6, 0.2],
    [0.0, 0.8],
    [-0.6, 0.2],
  ]),
  too_few: entry([
    [-0.5, 0.0],
    [0.5, 0.0],
  ]),
  // 20-vertex circle approximation — exercises the simplifyVertices path (>24)
  pineapple: entry(
    Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2;
      return [Math.cos(a) * 0.9, Math.sin(a) * 0.9] as [number, number];
    })
  ),
}));

jest.mock("../../../../assets/cosmos-vertices.json", () => ({
  moon: entry([
    [-0.7, -0.3],
    [0.7, -0.3],
    [0.0, 0.9],
  ]),
}));

import { getVerticesForFruit, getSpriteInfo } from "../fruitVertices";

describe("getVerticesForFruit", () => {
  // --- fruits set ---

  it("returns vertices for a known fruit key", () => {
    const verts = getVerticesForFruit("fruits", "cherry");
    expect(verts).not.toBeNull();
    expect(verts!.length).toBe(4);
    expect(verts![0]).toEqual({ x: -0.5, y: -0.5 });
  });

  it("maps raw [x, y] arrays to {x, y} objects", () => {
    const verts = getVerticesForFruit("fruits", "grapes");
    expect(verts).not.toBeNull();
    for (const pt of verts!) {
      expect(typeof pt.x).toBe("number");
      expect(typeof pt.y).toBe("number");
    }
  });

  it("returns null for an unknown fruit key", () => {
    expect(getVerticesForFruit("fruits", "nonexistent")).toBeNull();
  });

  it("returns null when the entry has fewer than 3 vertices", () => {
    expect(getVerticesForFruit("fruits", "too_few")).toBeNull();
  });

  // --- cosmos set ---

  it("returns vertices for a known cosmos key", () => {
    const verts = getVerticesForFruit("cosmos", "moon");
    expect(verts).not.toBeNull();
    expect(verts!.length).toBe(3);
  });

  // --- unknown set → null ---

  it("returns null for an unknown set id", () => {
    expect(getVerticesForFruit("unknown_set", "cherry")).toBeNull();
  });

  // --- vertex simplification ---

  it("returns at most 24 vertices when raw hull has more than 24 points", () => {
    const verts = getVerticesForFruit("fruits", "pineapple");
    expect(verts).not.toBeNull();
    expect(verts!.length).toBeLessThanOrEqual(24);
  });

  it("simplified vertices all lie within the [-1, 1] bounding box", () => {
    const verts = getVerticesForFruit("fruits", "pineapple");
    expect(verts).not.toBeNull();
    for (const pt of verts!) {
      expect(Math.abs(pt.x)).toBeLessThanOrEqual(1.0 + Number.EPSILON);
      expect(Math.abs(pt.y)).toBeLessThanOrEqual(1.0 + Number.EPSILON);
    }
  });

  // --- sprite info ---

  it("returns sprite info for a known fruit", () => {
    const info = getSpriteInfo("fruits", "cherry");
    expect(info).not.toBeNull();
    expect(typeof info!.offsetX).toBe("number");
    expect(typeof info!.scaleX).toBe("number");
  });

  it("returns null sprite info for unknown set", () => {
    expect(getSpriteInfo("unknown_set", "ruby")).toBeNull();
  });
});
