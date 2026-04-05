import React from "react";
import { render } from "@testing-library/react-native";
import DiceDisplay from "../DiceDisplay";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderDice(value: number | null, extraTurn = false) {
  return render(
    <ThemeProvider>
      <DiceDisplay value={value} extraTurn={extraTurn} />
    </ThemeProvider>
  );
}

describe("DiceDisplay", () => {
  it("shows ⚀ for value 1", () => {
    const { getByText } = renderDice(1);
    expect(getByText("⚀")).toBeTruthy();
  });

  it("shows ⚅ for value 6", () => {
    const { getByText } = renderDice(6);
    expect(getByText("⚅")).toBeTruthy();
  });

  it('shows "?" when value is null', () => {
    const { getByText } = renderDice(null);
    expect(getByText("?")).toBeTruthy();
  });

  it('shows "Roll again!" badge when extraTurn is true', () => {
    const { getByText } = renderDice(6, true);
    expect(getByText("Roll again!")).toBeTruthy();
  });

  it("does not show extra turn badge when extraTurn is false", () => {
    const { queryByText } = renderDice(3, false);
    expect(queryByText("Roll again!")).toBeNull();
  });
});
