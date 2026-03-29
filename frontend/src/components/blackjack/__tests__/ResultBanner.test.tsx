import React from "react";
import { render } from "@testing-library/react-native";
import ResultBanner from "../ResultBanner";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderBanner(outcome: string, payout: number) {
  return render(
    <ThemeProvider>
      <ResultBanner outcome={outcome} payout={payout} />
    </ThemeProvider>
  );
}

describe("ResultBanner", () => {
  it('shows "You Win!" for outcome "win"', () => {
    const { getByText } = renderBanner("win", 100);
    expect(getByText("You Win!")).toBeTruthy();
  });

  it('shows "Blackjack!" for outcome "blackjack"', () => {
    const { getByText } = renderBanner("blackjack", 150);
    expect(getByText("Blackjack!")).toBeTruthy();
  });

  it('shows "Push" for outcome "push"', () => {
    const { getByText } = renderBanner("push", 0);
    expect(getByText("Push")).toBeTruthy();
  });

  it('shows "You Lose" for outcome "lose"', () => {
    const { getByText } = renderBanner("lose", -100);
    expect(getByText("You Lose")).toBeTruthy();
  });

  it("shows positive payout text for wins", () => {
    const { getByText } = renderBanner("win", 100);
    expect(getByText("+100 chips")).toBeTruthy();
  });

  it("shows negative payout text for losses", () => {
    const { getByText } = renderBanner("lose", -100);
    expect(getByText("-100 chips")).toBeTruthy();
  });

  it('shows "No change" for zero payout', () => {
    const { getByText } = renderBanner("push", 0);
    expect(getByText("No change")).toBeTruthy();
  });
});
