import { renderHook } from "@testing-library/react-native";
import * as RN from "react-native";
import { useResponsiveCardSize } from "../CardSizeContext";

const spy = jest.spyOn(RN, "useWindowDimensions");

describe("useResponsiveCardSize", () => {
  afterEach(() => {
    spy.mockRestore();
  });

  it.each([320, 360, 1024, 1440])("snapshot at viewport width %i", (width) => {
    spy.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
    const { result } = renderHook(() => useResponsiveCardSize(52, 74, 7, 6));
    expect(result.current).toMatchSnapshot();
  });

  it("never exceeds natural card size", () => {
    spy.mockReturnValue({ width: 2000, height: 1200, scale: 1, fontScale: 1 });
    const { result } = renderHook(() => useResponsiveCardSize(52, 74, 7, 6));
    expect(result.current.cardWidth).toBe(52);
    expect(result.current.cardHeight).toBe(74);
  });

  it("clamps to minimum card width on narrow viewport", () => {
    spy.mockReturnValue({ width: 100, height: 600, scale: 1, fontScale: 1 });
    const { result } = renderHook(() => useResponsiveCardSize(52, 74, 7, 6));
    expect(result.current.cardWidth).toBeGreaterThanOrEqual(28);
  });

  it("scales proportionally between natural width and height", () => {
    spy.mockReturnValue({ width: 320, height: 800, scale: 1, fontScale: 1 });
    const { result } = renderHook(() => useResponsiveCardSize(52, 74, 7, 6));
    const ratio = result.current.cardHeight / result.current.cardWidth;
    const naturalRatio = 74 / 52;
    expect(ratio).toBeCloseTo(naturalRatio, 1);
  });
});
