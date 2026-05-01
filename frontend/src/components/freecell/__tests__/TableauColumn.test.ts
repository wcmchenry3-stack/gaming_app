import { computeCardOffset } from "../TableauColumn";
import { CARD_HEIGHT } from "../FreeCellSlot";

const FACE_UP_OFFSET = 36;
const MIN_FACE_UP_OFFSET = 12;
const TABLEAU_MAX_HEIGHT = 12 * FACE_UP_OFFSET + CARD_HEIGHT; // 489

describe("computeCardOffset", () => {
  it("single card returns full offset without dividing", () => {
    expect(computeCardOffset(1)).toBe(FACE_UP_OFFSET);
  });

  it("typical deal (6 cards) uses full spacing", () => {
    expect(computeCardOffset(6)).toBe(FACE_UP_OFFSET);
  });

  it("13 cards still use full spacing (exact boundary)", () => {
    // (489 - 57) / 12 = 36 exactly
    expect(computeCardOffset(13)).toBeCloseTo(FACE_UP_OFFSET, 5);
  });

  it("14 cards compress below full spacing", () => {
    const offset = computeCardOffset(14);
    expect(offset).toBeLessThan(FACE_UP_OFFSET);
    // Stack must fit within TABLEAU_MAX_HEIGHT
    expect(CARD_HEIGHT + 13 * offset).toBeLessThanOrEqual(TABLEAU_MAX_HEIGHT + 0.01);
  });

  it("37 cards clamp to minimum offset", () => {
    expect(computeCardOffset(37)).toBe(MIN_FACE_UP_OFFSET);
  });

  it("beyond minimum still clamps (no division below MIN)", () => {
    expect(computeCardOffset(52)).toBe(MIN_FACE_UP_OFFSET);
  });

  it("removing cards from compressed pile restores full spacing", () => {
    // Compressed at 20 cards
    expect(computeCardOffset(20)).toBeLessThan(FACE_UP_OFFSET);
    // Normal again at 10 cards
    expect(computeCardOffset(10)).toBe(FACE_UP_OFFSET);
  });

  it("compressed pile fits within TABLEAU_MAX_HEIGHT for pile sizes 14-36", () => {
    for (let n = 14; n <= 36; n++) {
      const offset = computeCardOffset(n);
      const height = CARD_HEIGHT + (n - 1) * offset;
      expect(height).toBeLessThanOrEqual(TABLEAU_MAX_HEIGHT + 0.01);
    }
  });
});
