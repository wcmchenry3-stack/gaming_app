import React from "react";
import { render } from "@testing-library/react-native";
import BlackjackScoreboard from "../BlackjackScoreboard";
import { ThemeProvider } from "../../../theme/ThemeContext";
import { initialSessionStats } from "../../../game/blackjack/sessionStats";

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("BlackjackScoreboard", () => {
  it("renders a zero-state hero + 'No hands yet' sub-line when no hands played", () => {
    const { getByText } = wrap(<BlackjackScoreboard stats={initialSessionStats(1000)} />);
    expect(getByText(/no hands yet/i)).toBeTruthy();
    // Chip balance card shows the starting chips with thousands separator.
    expect(getByText("1,000")).toBeTruthy();
  });

  it("renders a positive-P/L sign and win-rate sub-line for a winning session", () => {
    const stats = {
      ...initialSessionStats(1000),
      chips: 2240,
      plChips: 1240,
      handsPlayed: 13,
      handsWon: 8,
      handsLost: 4,
      handsPushed: 1,
      blackjacks: 2,
      busts: 1,
      biggestWin: 75,
    };
    const { getByText } = wrap(<BlackjackScoreboard stats={stats} />);
    // Hero P/L formatted with sign + thousands separator and template suffix.
    expect(getByText(/\+1,240/)).toBeTruthy();
    // Sub-line from i18n: "13 hands · 62% win rate" (8/13 = 62%)
    expect(getByText(/13 hands/)).toBeTruthy();
    expect(getByText(/62/)).toBeTruthy();
    // Six stat values render their counters.
    expect(getByText("2,240")).toBeTruthy(); // chip balance
    expect(getByText("+75")).toBeTruthy(); // biggest win
    expect(getByText("8")).toBeTruthy(); // hands won
    expect(getByText("4")).toBeTruthy(); // hands lost
    expect(getByText("2")).toBeTruthy(); // blackjacks
    expect(getByText("1")).toBeTruthy(); // busts
  });

  it("biggest-win card shows em-dash placeholder when no win has been recorded", () => {
    const stats = {
      ...initialSessionStats(1000),
      handsPlayed: 3,
      handsLost: 3,
      busts: 1,
      chips: 850,
      plChips: -150,
    };
    const { getAllByText } = wrap(<BlackjackScoreboard stats={stats} />);
    expect(getAllByText("—").length).toBeGreaterThan(0);
  });
});
