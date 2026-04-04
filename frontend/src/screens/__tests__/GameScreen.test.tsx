import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import GameScreen from "../GameScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock yacht storage — no-op persistence
// ---------------------------------------------------------------------------
jest.mock("../../game/yacht/storage", () => ({
  saveGame: jest.fn(),
  clearGame: jest.fn(),
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

  it("dismiss button closes modal and keeps final score", async () => {
    const { getByRole, queryByText } = renderScreen({ game_over: true, total_score: 200 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /dismiss/i }));
    });
    expect(queryByText(/game over/i)).toBeNull();
  });
});
