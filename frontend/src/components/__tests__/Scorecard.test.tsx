import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Scorecard from "../Scorecard";
import { ThemeProvider } from "../../theme/ThemeContext";

const ALL_CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "three_of_a_kind",
  "four_of_a_kind",
  "full_house",
  "small_straight",
  "large_straight",
  "yacht",
  "chance",
];

const emptyScores = Object.fromEntries(ALL_CATEGORIES.map((k) => [k, null]));

function renderScorecard(overrides: Partial<React.ComponentProps<typeof Scorecard>> = {}) {
  const defaults = {
    scores: emptyScores,
    possibleScores: {},
    rollsUsed: 0,
    gameOver: false,
    upperSubtotal: 0,
    upperBonus: 0,
    yachtBonusCount: 0,
    yachtBonusTotal: 0,
    totalScore: 0,
    onScore: jest.fn(),
  };
  const props = { ...defaults, ...overrides };
  return render(
    <ThemeProvider>
      <Scorecard {...props} />
    </ThemeProvider>
  );
}

describe("Scorecard", () => {
  it("renders all 13 category rows", () => {
    const { getAllByRole } = renderScorecard();
    // Each category is a Pressable button
    const rows = getAllByRole("button");
    expect(rows.length).toBe(13);
  });

  it("displays the total score", () => {
    const { getByText } = renderScorecard({ totalScore: 142 });
    expect(getByText("142")).toBeTruthy();
  });

  it("shows potential scores when rollsUsed > 0", () => {
    const { getByText } = renderScorecard({
      rollsUsed: 1,
      possibleScores: { ones: 3, twos: 6 },
    });
    expect(getByText("3")).toBeTruthy();
    expect(getByText("6")).toBeTruthy();
  });

  it("does not show potential scores when rollsUsed === 0", () => {
    const { queryByText } = renderScorecard({
      rollsUsed: 0,
      possibleScores: { ones: 3 },
    });
    // The value "3" should not appear as a potential score
    expect(queryByText("3")).toBeNull();
  });

  it("calls onScore with the correct category key when a row is pressed", () => {
    const onScore = jest.fn();
    const { getByRole } = renderScorecard({
      rollsUsed: 1,
      possibleScores: { ones: 3 },
      onScore,
    });
    fireEvent.press(getByRole("button", { name: /ones/i }));
    expect(onScore).toHaveBeenCalledWith("ones");
  });

  it("does not call onScore when rollsUsed === 0", () => {
    const onScore = jest.fn();
    const { getByRole } = renderScorecard({ rollsUsed: 0, onScore });
    fireEvent.press(getByRole("button", { name: /ones/i }));
    expect(onScore).not.toHaveBeenCalled();
  });

  it("does not call onScore for an already-scored category", () => {
    const onScore = jest.fn();
    const { getByRole } = renderScorecard({
      rollsUsed: 1,
      scores: { ...emptyScores, ones: 3 },
      possibleScores: { twos: 6 },
      onScore,
    });
    fireEvent.press(getByRole("button", { name: /ones/i }));
    expect(onScore).not.toHaveBeenCalled();
  });

  it("shows bonus progress text when upperBonus === 0", () => {
    const { getByText } = renderScorecard({ upperSubtotal: 21, upperBonus: 0 });
    // Bonus progress includes the subtotal
    expect(getByText(/21/)).toBeTruthy();
  });

  it("shows bonus achieved text when upperBonus > 0", () => {
    const { getByText } = renderScorecard({ upperSubtotal: 63, upperBonus: 35 });
    // bonus.achieved = "{{subtotal}} / 63 ✓" — the ✓ is unique to the achieved state
    expect(getByText(/✓/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GH #263 — scorecard reset: all-null scores render blank (upper & lower)
// ---------------------------------------------------------------------------

const UPPER_CATS = ["Ones", "Twos", "Threes", "Fours", "Fives", "Sixes"];
const LOWER_CATS = [
  "Three of a Kind",
  "Four of a Kind",
  "Full House (25)",
  "Sm. Straight (30)",
  "Lg. Straight (40)",
  "Yacht! (50)",
  "Chance",
];

describe("Scorecard — reset to all-null scores (GH #263)", () => {
  it("renders all upper section rows as 'not available' when scores are null", () => {
    const { getByRole } = renderScorecard({ rollsUsed: 0 });
    for (const cat of UPPER_CATS) {
      expect(getByRole("button", { name: new RegExp(`${cat}:.*not available`, "i") })).toBeTruthy();
    }
  });

  it("renders all lower section rows as 'not available' when scores are null", () => {
    const { getByRole } = renderScorecard({ rollsUsed: 0 });
    for (const cat of LOWER_CATS) {
      // Use a loose regex — category labels include point values like "(25)"
      expect(
        getByRole("button", {
          name: new RegExp(`${cat.replace(/[()]/g, "\\$&")}.*not available`, "i"),
        })
      ).toBeTruthy();
    }
  });

  it("transitions upper rows from scored to 'not available' when scores reset to null", () => {
    const filledScores = Object.fromEntries(ALL_CATEGORIES.map((k) => [k, 5]));
    const { rerender, getByRole } = renderScorecard({
      scores: filledScores,
      rollsUsed: 0,
    });
    // Confirm "scored" state
    expect(getByRole("button", { name: /Ones:.*scored/i })).toBeTruthy();

    // Re-render with all-null scores (simulating new game)
    rerender(
      <ThemeProvider>
        <Scorecard
          scores={emptyScores}
          possibleScores={{}}
          rollsUsed={0}
          gameOver={false}
          upperSubtotal={0}
          upperBonus={0}
          yachtBonusCount={0}
          yachtBonusTotal={0}
          totalScore={0}
          onScore={jest.fn()}
        />
      </ThemeProvider>
    );
    for (const cat of UPPER_CATS) {
      expect(getByRole("button", { name: new RegExp(`${cat}:.*not available`, "i") })).toBeTruthy();
    }
  });

  it("transitions lower rows from scored to 'not available' when scores reset to null", () => {
    const filledScores = Object.fromEntries(ALL_CATEGORIES.map((k) => [k, 5]));
    const { rerender, getByRole } = renderScorecard({
      scores: filledScores,
      rollsUsed: 0,
    });
    expect(getByRole("button", { name: /Chance:.*scored/i })).toBeTruthy();

    rerender(
      <ThemeProvider>
        <Scorecard
          scores={emptyScores}
          possibleScores={{}}
          rollsUsed={0}
          gameOver={false}
          upperSubtotal={0}
          upperBonus={0}
          yachtBonusCount={0}
          yachtBonusTotal={0}
          totalScore={0}
          onScore={jest.fn()}
        />
      </ThemeProvider>
    );
    for (const cat of LOWER_CATS) {
      expect(
        getByRole("button", {
          name: new RegExp(`${cat.replace(/[()]/g, "\\$&")}.*not available`, "i"),
        })
      ).toBeTruthy();
    }
  });
});
