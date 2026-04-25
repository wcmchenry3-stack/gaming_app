import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import { ThemeProvider } from "../../../../theme/ThemeContext";
import type { Card } from "../../types";
import FoundationPile from "../FoundationPile";

function withTheme(children: React.ReactNode) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function card(rank: number): Card {
  return { suit: "hearts", rank: rank as Card["rank"], faceUp: true };
}

describe("FoundationPile", () => {
  it("renders a suit-symbol placeholder when empty", () => {
    const { getByText, getByLabelText } = render(
      withTheme(<FoundationPile pile={[]} suit="diamonds" />)
    );
    expect(getByText("♦")).toBeTruthy();
    expect(getByLabelText(/Empty Diamonds foundation/)).toBeTruthy();
  });

  it("fires onPress with the suit when the empty placeholder is tapped", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      withTheme(<FoundationPile pile={[]} suit="clubs" onPress={onPress} />)
    );
    fireEvent.press(getByLabelText(/Empty Clubs foundation/));
    expect(onPress).toHaveBeenCalledWith("clubs");
  });

  it("renders the top card when the pile is non-empty", () => {
    const pile = [card(1), card(2), card(3)];
    const { getByText } = render(withTheme(<FoundationPile pile={pile} suit="hearts" />));
    // Top card is 3♥
    expect(getByText("3")).toBeTruthy();
    expect(getByText("♥")).toBeTruthy();
  });

  it("fires onPress with the suit when the top card is tapped", () => {
    const onPress = jest.fn();
    const pile = [card(1), card(2)];
    const { getByRole } = render(
      withTheme(<FoundationPile pile={pile} suit="hearts" onPress={onPress} />)
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledWith("hearts");
  });
});
