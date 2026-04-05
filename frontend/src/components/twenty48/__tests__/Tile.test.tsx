import React from "react";
import { render } from "@testing-library/react-native";
import Tile from "../Tile";

describe("Tile", () => {
  it.each([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048])(
    "renders correct number text for value %i",
    (value) => {
      const { getByText } = render(<Tile value={value} size={80} />);
      expect(getByText(String(value))).toBeTruthy();
    }
  );

  it("renders nothing for value 0 (empty tile)", () => {
    const { queryByText } = render(<Tile value={0} size={80} />);
    // No number text should appear
    expect(queryByText("0")).toBeNull();
  });

  it("has accessibilityLabel 'empty' for value 0", () => {
    const { getByLabelText } = render(<Tile value={0} size={80} />);
    expect(getByLabelText("empty")).toBeTruthy();
  });

  it("has accessibilityLabel matching value for non-zero tiles", () => {
    const { getByLabelText } = render(<Tile value={128} size={80} />);
    expect(getByLabelText("128")).toBeTruthy();
  });

  it("uses smaller font size for 4-digit numbers", () => {
    const { getByText } = render(<Tile value={1024} size={80} />);
    const text = getByText("1024");
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 18 })])
    );
  });

  it("uses smallest font size for 5-digit numbers", () => {
    const { getByText } = render(<Tile value={16384} size={80} />);
    const text = getByText("16384");
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 14 })])
    );
  });

  it("uses large font size for 2-digit numbers", () => {
    const { getByText } = render(<Tile value={64} size={80} />);
    const text = getByText("64");
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 28 })])
    );
  });

  it("uses medium font size for 3-digit numbers", () => {
    const { getByText } = render(<Tile value={256} size={80} />);
    const text = getByText("256");
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 22 })])
    );
  });

  it("applies known tile color for value 2", () => {
    const { getByLabelText } = render(<Tile value={2} size={80} />);
    const tile = getByLabelText("2");
    expect(tile.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#eee4da" })])
    );
  });

  it("applies fallback color for unknown high values", () => {
    const { getByLabelText } = render(<Tile value={4096} size={80} />);
    const tile = getByLabelText("4096");
    expect(tile.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#3c3a32" })])
    );
  });
});
