import { computeCardSize } from "../CardSizeContext";

describe("computeCardSize", () => {
  it.each([320, 360, 1024, 1440])("snapshot at viewport width %i", (width) => {
    expect(computeCardSize(width, 52, 74, 7, 6)).toMatchSnapshot();
  });

  it("scales down at 320px viewport", () => {
    const { cardWidth } = computeCardSize(320, 52, 74, 7, 6);
    expect(cardWidth).toBeLessThan(52);
  });

  it("never exceeds natural card size", () => {
    const { cardWidth, cardHeight } = computeCardSize(2000, 52, 74, 7, 6);
    expect(cardWidth).toBe(52);
    expect(cardHeight).toBe(74);
  });

  it("clamps to minimum card width on narrow viewport", () => {
    const { cardWidth } = computeCardSize(100, 52, 74, 7, 6);
    expect(cardWidth).toBeGreaterThanOrEqual(28);
  });

  it("scales proportionally between natural width and height", () => {
    const { cardWidth, cardHeight } = computeCardSize(320, 52, 74, 7, 6);
    expect(cardHeight / cardWidth).toBeCloseTo(74 / 52, 1);
  });

  it("accounts for horizontal padding when computing scale", () => {
    const withoutPadding = computeCardSize(400, 52, 74, 7, 6);
    const withPadding = computeCardSize(400, 52, 74, 7, 6, 48);
    expect(withPadding.cardWidth).toBeLessThanOrEqual(withoutPadding.cardWidth);
  });
});
