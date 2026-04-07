import { FRUIT_SETS, FruitTier } from "../fruitSets";

const ALL_TIERS: FruitTier[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("fruitSets structure", () => {
  it("defines exactly two sets", () => {
    expect(Object.keys(FRUIT_SETS)).toHaveLength(2);
    expect(FRUIT_SETS).toHaveProperty("fruits");
    expect(FRUIT_SETS).toHaveProperty("cosmos");
  });

  for (const [setId, set] of Object.entries(FRUIT_SETS)) {
    describe(`set: ${setId}`, () => {
      it("has exactly 11 fruit definitions", () => {
        expect(set.fruits).toHaveLength(11);
      });

      it("has no duplicate tiers", () => {
        const tiers = set.fruits.map((f) => f.tier);
        const unique = new Set(tiers);
        expect(unique.size).toBe(11);
      });

      it("covers all tiers 0–10", () => {
        const tiers = set.fruits.map((f) => f.tier).sort((a, b) => a - b);
        expect(tiers).toEqual(ALL_TIERS);
      });

      it("every fruit has a non-empty name, emoji, and color", () => {
        for (const fruit of set.fruits) {
          expect(fruit.name.length).toBeGreaterThan(0);
          expect(fruit.emoji.length).toBeGreaterThan(0);
          expect(fruit.color.length).toBeGreaterThan(0);
        }
      });

      it("all entries have image assets", () => {
        for (const fruit of set.fruits) {
          expect(fruit.icon).toBeTruthy();
        }
      });

      it("radii increase monotonically with tier", () => {
        const sorted = [...set.fruits].sort((a, b) => a.tier - b.tier);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].radius).toBeGreaterThan(sorted[i - 1].radius);
        }
      });

      it("score values increase monotonically with tier (except tier 10 bonus)", () => {
        const sorted = [...set.fruits].sort((a, b) => a.tier - b.tier);
        for (let i = 1; i < sorted.length - 1; i++) {
          expect(sorted[i].scoreValue).toBeGreaterThan(sorted[i - 1].scoreValue);
        }
      });
    });
  }

  it("radii are identical across all sets for each tier", () => {
    const sets = Object.values(FRUIT_SETS);
    for (const tier of ALL_TIERS) {
      const radii = sets.map((s) => s.fruits[tier].radius);
      expect(new Set(radii).size).toBe(1);
    }
  });

  it("uses the requested smallest-to-largest order for cosmos", () => {
    expect(FRUIT_SETS.cosmos.fruits.map((fruit) => fruit.name)).toEqual([
      "Moon",
      "Pluto",
      "Mercury",
      "Mars",
      "Venus",
      "Earth",
      "Neptune",
      "Uranus",
      "Saturn",
      "Jupiter",
      "Sun",
    ]);
  });
});
