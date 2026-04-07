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

import { getVerticesForFruit, getSpriteInfo, spriteClipRadius } from "../fruitVertices";

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

// ---------------------------------------------------------------------------
// spriteClipRadius — GH #264 Uranus/Saturn ring clipping fix
// ---------------------------------------------------------------------------

describe("spriteClipRadius", () => {
  it("returns sqrt(2)*scale*r for a centred sprite (offsetX=offsetY=0)", () => {
    // All four corners are equidistant from origin at sqrt(sx^2 + sy^2)*r
    const r = 68;
    const sx = 1.251069;
    const result = spriteClipRadius({ offsetX: 0, offsetY: 0, scaleX: sx, scaleY: sx }, r);
    expect(result).toBeCloseTo(Math.hypot(sx, sx) * r, 4);
  });

  it("returns a value greater than r for a unit-scale centred sprite", () => {
    // Even scale=1 with no offset gives sqrt(2)*r ≈ 1.414*r, ensuring the
    // full image bounding box is visible (corners are at distance sqrt(2)*r)
    const r = 100;
    expect(spriteClipRadius({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }, r)).toBeGreaterThan(
      r
    );
  });

  it("uses the farthest corner — positive offset increases the clip radius", () => {
    const r = 100;
    const base = spriteClipRadius({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }, r);
    const shifted = spriteClipRadius({ offsetX: 0.2, offsetY: 0.2, scaleX: 1, scaleY: 1 }, r);
    expect(shifted).toBeGreaterThan(base);
  });

  it("scales linearly with r", () => {
    const sprite = { offsetX: 0.05, offsetY: 0.16, scaleX: 1.25, scaleY: 1.25 };
    const r1 = spriteClipRadius(sprite, 68);
    const r2 = spriteClipRadius(sprite, 136);
    expect(r2).toBeCloseTo(r1 * 2, 4);
  });

  it("Uranus parameters — clip radius is substantially larger than physics radius", () => {
    // Uranus: tier 7, physics radius=68, spriteScale=1.251069, spriteOffset=[0.054368, 0.155773]
    const uranusSprite = {
      offsetX: 0.054368,
      offsetY: 0.155773,
      scaleX: 1.251069,
      scaleY: 1.251069,
    };
    const clipR = spriteClipRadius(uranusSprite, 68);
    // Rings extend well beyond the 68px physics radius
    expect(clipR).toBeGreaterThan(68);
    // Farthest corner: sqrt((0.054368+1.251069)^2 + (0.155773+1.251069)^2) * 68 ≈ 130px
    expect(clipR).toBeCloseTo(Math.hypot(0.054368 + 1.251069, 0.155773 + 1.251069) * 68, 1);
  });

  it("Saturn parameters — clip radius exceeds physics radius", () => {
    // Saturn: tier 8, physics radius=76, spriteScale=1.135885, spriteOffset=[0.047144, 0.058236]
    const saturnSprite = {
      offsetX: 0.047144,
      offsetY: 0.058236,
      scaleX: 1.135885,
      scaleY: 1.135885,
    };
    const clipR = spriteClipRadius(saturnSprite, 76);
    expect(clipR).toBeGreaterThan(76);
  });
});
