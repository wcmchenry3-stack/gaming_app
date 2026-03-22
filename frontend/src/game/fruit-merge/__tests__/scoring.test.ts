import { scoreForMerge } from "../scoring";
import { FruitTier } from "../../../theme/fruitSets";

describe("scoreForMerge", () => {
  it("returns 2 for tier 0 (cherry merge produces blueberry)", () => {
    expect(scoreForMerge(0)).toBe(2);
  });

  it("returns 4 for tier 1", () => {
    expect(scoreForMerge(1)).toBe(4);
  });

  it("doubles each tier", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => scoreForMerge(t as FruitTier));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe(values[i - 1] * 2);
    }
  });

  it("returns 256 bonus for tier 10 (watermelon disappears)", () => {
    expect(scoreForMerge(10)).toBe(256);
  });

  it("score accumulates correctly across multiple merges", () => {
    const total = scoreForMerge(0) + scoreForMerge(1) + scoreForMerge(10);
    expect(total).toBe(2 + 4 + 256);
  });
});
