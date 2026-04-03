/**
 * Tests for fruitVertices.ts — the runtime vertex lookup module.
 *
 * Both JSON imports are mocked so the tests do not depend on the generated
 * asset files being present in the repo, and run instantly.
 */

jest.mock("../../../../assets/fruit-vertices.json", () => ({
  cherry: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  grapes: [
    [-0.4, -0.6],
    [0.4, -0.6],
    [0.6, 0.2],
    [0.0, 0.8],
    [-0.6, 0.2],
  ],
  too_few: [
    [-0.5, 0.0],
    [0.5, 0.0],
  ], // only 2 points → should return null
  // 20-vertex circle approximation — exercises the simplifyVertices path (>12)
  pineapple: Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return [Math.cos(a) * 0.9, Math.sin(a) * 0.9];
  }),
}));

jest.mock("../../../../assets/planet-vertices.json", () => ({
  moon: [
    [-0.7, -0.3],
    [0.7, -0.3],
    [0.0, 0.9],
  ],
}));

import { getVerticesForFruit } from "../fruitVertices";

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

  // --- planets set ---

  it("returns vertices for a known planet key", () => {
    const verts = getVerticesForFruit("planets", "moon");
    expect(verts).not.toBeNull();
    expect(verts!.length).toBe(3);
  });

  // --- gems / unknown set → circle fallback ---

  it("returns null for the gems set", () => {
    expect(getVerticesForFruit("gems", "ruby")).toBeNull();
  });

  it("returns null for an unknown set id", () => {
    expect(getVerticesForFruit("unknown_set", "cherry")).toBeNull();
  });

  // --- vertex simplification ---

  it("returns at most 12 vertices when raw hull has more than 12 points", () => {
    const verts = getVerticesForFruit("fruits", "pineapple");
    expect(verts).not.toBeNull();
    expect(verts!.length).toBeLessThanOrEqual(12);
  });

  it("simplified vertices all lie within the unit circle (max_dist ≤ 1.0)", () => {
    const verts = getVerticesForFruit("fruits", "pineapple");
    expect(verts).not.toBeNull();
    for (const pt of verts!) {
      expect(Math.hypot(pt.x, pt.y)).toBeLessThanOrEqual(1.0 + Number.EPSILON);
    }
  });
});
