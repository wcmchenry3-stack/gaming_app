import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import { ThemeProvider } from "../../../../theme/ThemeContext";
import type { Card, Rank, Suit } from "../../types";
import TableauPile from "../TableauPile";

function withTheme(children: React.ReactNode) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function card(suit: Suit, rank: Rank, faceUp = true): Card {
  return { suit, rank, faceUp };
}

describe("TableauPile", () => {
  it("renders a dashed placeholder when the column is empty", () => {
    const { getByLabelText } = render(withTheme(<TableauPile pile={[]} colIndex={0} />));
    expect(getByLabelText(/Empty tableau column 1/)).toBeTruthy();
  });

  it("fires onEmptyPress when the empty placeholder is tapped", () => {
    const onEmptyPress = jest.fn();
    const { getByLabelText } = render(
      withTheme(<TableauPile pile={[]} colIndex={2} onEmptyPress={onEmptyPress} />)
    );
    fireEvent.press(getByLabelText(/Empty tableau column 3/));
    expect(onEmptyPress).toHaveBeenCalledWith(2);
  });

  it("renders every card in the pile and exposes the pile-size label", () => {
    const pile = [card("spades", 5, false), card("hearts", 6), card("clubs", 5)];
    const { getByText, getByLabelText } = render(
      withTheme(<TableauPile pile={pile} colIndex={1} />)
    );
    // Face-up cards contribute their rank text; the face-down one does not.
    expect(getByText("6")).toBeTruthy();
    expect(getByText("5")).toBeTruthy(); // clubs 5 (top)
    expect(getByLabelText(/Tableau column 2, 3 cards/)).toBeTruthy();
  });

  it("fires onCardPress with (colIndex, cardIndex) when a card is tapped", () => {
    const onCardPress = jest.fn();
    const pile = [card("spades", 1), card("hearts", 2)];
    const { getAllByRole } = render(
      withTheme(<TableauPile pile={pile} colIndex={4} onCardPress={onCardPress} />)
    );
    const buttons = getAllByRole("button");
    fireEvent.press(buttons[1]!); // second card (index 1)
    expect(onCardPress).toHaveBeenCalledWith(4, 1);
  });

  it("highlights the selected card and every card stacked on top of it", () => {
    const pile = [card("spades", 5), card("hearts", 4), card("clubs", 3)];
    const { getAllByLabelText } = render(
      withTheme(<TableauPile pile={pile} colIndex={0} selectedIndex={1} />)
    );
    // Index 0 not selected; indices 1 and 2 are.
    const selectedLabels = getAllByLabelText(/\(selected\)/);
    expect(selectedLabels).toHaveLength(2);
  });
});
