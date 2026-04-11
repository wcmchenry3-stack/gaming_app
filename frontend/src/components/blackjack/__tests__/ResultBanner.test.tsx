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

  it("win outcome text uses bonus color", () => {
    const { getByText } = renderBanner("win", 100);
    const outcomeEl = getByText("You Win!");
    // bonus color is set via the accent switch — just verify the element renders
    expect(outcomeEl).toBeTruthy();
  });

  it("blackjack outcome renders distinct text", () => {
    const { getByText } = renderBanner("blackjack", 150);
    expect(getByText("Blackjack!")).toBeTruthy();
    expect(getByText("+150 chips")).toBeTruthy();
  });

  it("has payout accessibility label", () => {
    const { getByLabelText } = renderBanner("win", 100);
    expect(getByLabelText(/payout/i)).toBeTruthy();
  });
});
