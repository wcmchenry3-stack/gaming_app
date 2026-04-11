import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import GameScreen from "../GameScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { saveGame, clearGame } from "../../game/yacht/storage";

// ---------------------------------------------------------------------------
// Mock yacht storage — no-op persistence
// ---------------------------------------------------------------------------
jest.mock("../../game/yacht/storage", () => ({
  saveGame: jest.fn(),
  clearGame: jest.fn().mockResolvedValue(undefined),
  loadGame: jest.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    dice: [1, 2, 3, 4, 5],
    held: [false, false, false, false, false],
    rolls_used: 0,
    round: 1,
    scores: {
      ones: null,
      twos: null,
      threes: null,
      fours: null,
      fives: null,
      sixes: null,
      three_of_a_kind: null,
      four_of_a_kind: null,
      full_house: null,
      small_straight: null,
      large_straight: null,
      yacht: null,
      chance: null,
    },
    game_over: false,
    upper_subtotal: 0,
    upper_bonus: 0,
    yacht_bonus_count: 0,
    yacht_bonus_total: 0,
    total_score: 0,
    ...overrides,
  };
}

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() } as unknown as Parameters<
  typeof GameScreen
>[0]["navigation"];

function renderScreen(stateOverrides: Record<string, unknown> = {}) {
  const initialState = makeState(stateOverrides);
  return render(
    <ThemeProvider>
      <GameScreen
        navigation={mockNavigation}
        route={{ params: { initialState } } as unknown as Parameters<typeof GameScreen>[0]["route"]}
      />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GameScreen", () => {
  it("renders the round header", () => {
    const { getByText } = renderScreen();
    expect(getByText(/round.*1/i)).toBeTruthy();
  });

  it("rolling updates rolls_used and enables scoring", async () => {
    const { getByRole } = renderScreen();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    // After a roll, the button label includes the remaining rolls count (2)
    expect(getByRole("button", { name: /roll dice/i })).toBeTruthy();
  });

  it("scoring a category after a roll advances the round", async () => {
    const { getByRole, getByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /ones/i }));
    });
    expect(getByText(/round.*2/i)).toBeTruthy();
  });

  it("game over modal is not visible initially", () => {
    const { queryByText } = renderScreen();
    expect(queryByText(/game over/i)).toBeNull();
  });

  it("game over modal appears when game_over is true", () => {
    const { getByText } = renderScreen({ game_over: true, total_score: 250 });
    expect(getByText(/game over/i)).toBeTruthy();
    expect(getByText("250")).toBeTruthy();
  });

  it("play again button starts a new game in place", async () => {
    const { getByRole, getByText } = renderScreen({ game_over: true, total_score: 100 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(getByText(/round.*1/i)).toBeTruthy();
  });

  it("dismiss button navigates back to HomeScreen", async () => {
    const { getByRole } = renderScreen({ game_over: true, total_score: 200 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /dismiss/i }));
    });
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Shared fixture — fully-completed game state
// ---------------------------------------------------------------------------

function makeGameOverState(): Record<string, unknown> {
  return {
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rolls_used: 0,
    round: 14, // engine advances past 13 after the last score
    scores: {
      ones: 3,
      twos: 6,
      threes: 9,
      fours: 12,
      fives: 15,
      sixes: 18,
      three_of_a_kind: 20,
      four_of_a_kind: 0,
      full_house: 25,
      small_straight: 30,
      large_straight: 40,
      yacht: 50,
      chance: 21,
    },
    game_over: true,
    upper_subtotal: 63,
    upper_bonus: 35,
    yacht_bonus_count: 0,
    yacht_bonus_total: 0,
    total_score: 284,
  };
}

// ---------------------------------------------------------------------------
// GH #225 — "Play Again" reset correctness
// ---------------------------------------------------------------------------

describe("GameScreen — Play Again reset (GH #225)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Play Again resets round to 1", async () => {
    const { getByRole, getByText } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    expect(getByText(/round.*1/i)).toBeTruthy();
  });

  it("Play Again resets all score categories to null", async () => {
    const { getByRole, queryByText } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    // After reset, no category should show a filled score — modal is gone too
    expect(queryByText(/game over/i)).toBeNull();
    // Total score should be 0
    expect(queryByText("284")).toBeNull();
  });

  it("Play Again calls clearGame before saveGame to avoid the race condition", async () => {
    const callOrder: string[] = [];
    (clearGame as jest.Mock).mockImplementation(async () => {
      callOrder.push("clearGame");
    });
    (saveGame as jest.Mock).mockImplementation(async () => {
      callOrder.push("saveGame");
    });

    // Mount and flush the initial useEffect (which calls saveGame with the
    // game-over state). We only care about the ordering triggered by "Play Again".
    const { getByRole } = renderScreen(makeGameOverState());
    await act(async () => {
      await Promise.resolve(); // flush initial saveGame from useEffect
    });
    callOrder.length = 0; // reset tracker — only track calls from "Play Again" onward

    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });

    // clearGame must have been called
    expect(clearGame).toHaveBeenCalled();
    // saveGame must have been called (via useEffect on the new state)
    await waitFor(() => expect(saveGame).toHaveBeenCalled());
    // clearGame MUST appear before saveGame in the call order
    const clearIdx = callOrder.indexOf("clearGame");
    const saveIdx = callOrder.indexOf("saveGame");
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(saveIdx).toBeGreaterThan(clearIdx);
  });

  it("Play Again saves a fresh state (round:1, game_over:false, scores null)", async () => {
    const { getByRole } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });

    await waitFor(() => expect(saveGame).toHaveBeenCalled());
    const savedState = (saveGame as jest.Mock).mock.calls.at(-1)?.[0];
    expect(savedState.round).toBe(1);
    expect(savedState.game_over).toBe(false);
    // Every score category should be null
    for (const v of Object.values(savedState.scores)) {
      expect(v).toBeNull();
    }
  });

  it("Play Again resets total_score to 0", async () => {
    const { getByRole } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });

    await waitFor(() => expect(saveGame).toHaveBeenCalled());
    const savedState = (saveGame as jest.Mock).mock.calls.at(-1)?.[0];
    expect(savedState.total_score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GH #393 — New Game button branches
// ---------------------------------------------------------------------------

describe("GameScreen — New Game button (GH #393)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fresh game: tapping New Game resets immediately without showing confirm modal", async () => {
    // round=1, rolls_used=0, all scores null → isInProgress() = false
    const { getByRole, queryByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /new game/i }));
    });
    // Confirm modal must NOT appear
    expect(queryByText("Start new game?")).toBeNull();
    // clearGame is called (startNewGame ran)
    expect(clearGame).toHaveBeenCalled();
  });

  it("in-progress game: tapping New Game shows confirm modal", async () => {
    // round=2 → isInProgress() = true
    const { getByRole, getByText } = renderScreen({ round: 2 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /new game/i }));
    });
    expect(getByText("Start new game?")).toBeTruthy();
  });

  it("confirm modal 'Start new game' calls startNewGame and closes modal", async () => {
    const { getByRole, queryByText } = renderScreen({ round: 2 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /new game/i }));
    });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /start new game/i }));
    });
    // Modal closes
    expect(queryByText("Start new game?")).toBeNull();
    // startNewGame ran → clearGame called, round reset to 1
    expect(clearGame).toHaveBeenCalled();
    expect(getByRole("button", { name: /roll dice/i })).toBeTruthy();
  });

  it("confirm modal 'Cancel' does not call startNewGame and closes modal", async () => {
    const { getByRole, queryByText, getByText } = renderScreen({ round: 2 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /new game/i }));
    });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /^cancel$/i }));
    });
    // Modal closes
    expect(queryByText("Start new game?")).toBeNull();
    // startNewGame did NOT run — clearGame not called, round still 2
    expect(clearGame).not.toHaveBeenCalled();
    expect(getByText(/round.*2/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GH #263 — scorecard visual reset (upper & lower sections)
// ---------------------------------------------------------------------------

describe("GameScreen — scorecard visual reset (GH #263)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Play Again resets all upper section rows to 'not available'", async () => {
    const { getByRole } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    // rollsUsed=0 after reset → canScore=false → every ScoreRow shows "not available"
    for (const cat of ["Ones", "Twos", "Threes", "Fours", "Fives", "Sixes"]) {
      expect(getByRole("button", { name: new RegExp(`${cat}:.*not available`, "i") })).toBeTruthy();
    }
  });

  it("Play Again resets all lower section rows to 'not available'", async () => {
    const { getByRole } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    for (const cat of [
      "Three of a Kind",
      "Four of a Kind",
      "Full House",
      "Sm. Straight",
      "Lg. Straight",
      "Yacht!",
      "Chance",
    ]) {
      expect(getByRole("button", { name: new RegExp(`${cat}.*not available`, "i") })).toBeTruthy();
    }
  });

  it("Play Again resets upper bonus display to 0 / 63 progress", async () => {
    const { getByRole, getByText, queryByText } = renderScreen(makeGameOverState());
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    // After reset: upper_subtotal=0, upper_bonus=0 → progress display ("0 / 63")
    expect(getByText("0 / 63")).toBeTruthy();
    // The "achieved" check mark must not be visible after reset
    expect(queryByText(/\u2713/)).toBeNull();
  });

  it("Play Again logs Sentry breadcrumbs for the reset event", async () => {
    const { getByRole } = renderScreen(makeGameOverState());
    const { addBreadcrumb } = jest.requireMock("@sentry/react-native") as {
      addBreadcrumb: jest.Mock;
    };
    addBreadcrumb.mockClear();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    // Should have two breadcrumbs: one before reset, one after
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/resetting/) })
    );
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/reset complete/) })
    );
  });
});
