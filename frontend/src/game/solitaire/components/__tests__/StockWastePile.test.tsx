import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import { ThemeProvider } from "../../../../theme/ThemeContext";
import type { Card } from "../../types";
import StockWastePile from "../StockWastePile";

function withTheme(children: React.ReactNode) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function card(rank: number): Card {
  return { suit: "spades", rank: rank as Card["rank"], faceUp: true };
}

describe("StockWastePile", () => {
  it("shows the remaining stock count and the waste top card", () => {
    const stock = [card(1), card(2), card(3), card(4), card(5)];
    const waste = [card(6), card(7)];
    const { getByText, getByLabelText } = render(
      withTheme(<StockWastePile stock={stock} waste={waste} drawMode={1} />)
    );
    expect(getByText("5")).toBeTruthy(); // stock count
    expect(getByLabelText(/Draw 1 from stock, 5 cards remaining/)).toBeTruthy();
    expect(getByText("7")).toBeTruthy(); // waste top rank
  });

  it("shows the recycle symbol when stock is empty and labels the action accordingly", () => {
    const { getByText, getByLabelText } = render(
      withTheme(<StockWastePile stock={[]} waste={[card(1)]} drawMode={3} />)
    );
    expect(getByText("↻")).toBeTruthy();
    expect(getByLabelText(/Recycle waste back to stock \(draw 3\)/)).toBeTruthy();
  });

  it("fires onStockPress when the stock is tapped", () => {
    const onStockPress = jest.fn();
    const { getByLabelText } = render(
      withTheme(
        <StockWastePile stock={[card(1)]} waste={[]} drawMode={1} onStockPress={onStockPress} />
      )
    );
    fireEvent.press(getByLabelText(/Draw 1 from stock/));
    expect(onStockPress).toHaveBeenCalledTimes(1);
  });

  it("fires onWastePress when the waste top is tapped", () => {
    const onWastePress = jest.fn();
    const { getByRole } = render(
      withTheme(
        <StockWastePile
          stock={[card(1)]}
          waste={[card(7)]}
          drawMode={1}
          onWastePress={onWastePress}
        />
      )
    );
    // Two buttons rendered: stock (no onStockPress => View, not button) and
    // waste (onWastePress => button). So there should be exactly one button.
    fireEvent.press(getByRole("button"));
    expect(onWastePress).toHaveBeenCalledTimes(1);
  });

  it("labels the waste as empty when the waste pile is empty", () => {
    const { getByLabelText } = render(
      withTheme(<StockWastePile stock={[card(1)]} waste={[]} drawMode={1} />)
    );
    expect(getByLabelText(/Empty waste pile/)).toBeTruthy();
  });
});
