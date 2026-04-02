import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import GameScreen from "../GameScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
jest.mock("../../api/client", () => ({
  api: {
    roll: jest.fn(),
    score: jest.fn(),
    possibleScores: jest.fn(),
    newGame: jest.fn(),
  },
}));

import { api } from "../../api/client";
const mockApi = api as jest.Mocked<typeof api>;

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
      yahtzee: null,
      chance: null,
    },
    game_over: false,
    upper_subtotal: 0,
    upper_bonus: 0,
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
        route={{ params: { initialState } } as Parameters<typeof GameScreen>[0]["route"]}
      />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.possibleScores.mockResolvedValue({ possible_scores: {} });
});

describe("GameScreen", () => {
  it("renders the round header", () => {
    const { getByText } = renderScreen();
    expect(getByText(/round.*1/i)).toBeTruthy();
  });

  it("calls api.roll when the roll button is pressed", async () => {
    mockApi.roll.mockResolvedValue(makeState({ rolls_used: 1 }));
    const { getByRole } = renderScreen();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    expect(mockApi.roll).toHaveBeenCalledWith([false, false, false, false, false]);
  });

  it("updates displayed state after a successful roll", async () => {
    mockApi.roll.mockResolvedValue(makeState({ rolls_used: 1, round: 2 }));
    const { getByRole } = renderScreen();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    await waitFor(() => {
      expect(getByRole("button", { name: /roll dice/i })).toBeTruthy();
    });
  });

  it("shows an error message when api.roll throws", async () => {
    mockApi.roll.mockRejectedValue(new Error("Network error"));
    const { getByRole, findByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    expect(await findByText("Network error")).toBeTruthy();
  });

  it("calls api.score when a scorecard category is pressed after rolling", async () => {
    mockApi.roll.mockResolvedValue(makeState({ rolls_used: 1, dice: [1, 1, 1, 1, 1] }));
    mockApi.score.mockResolvedValue(makeState({ rolls_used: 0, round: 2 }));
    mockApi.possibleScores.mockResolvedValue({ possible_scores: { ones: 5 } });

    const { getByRole } = renderScreen();

    // Roll first to enable scoring
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });

    await act(async () => {
      fireEvent.press(getByRole("button", { name: /ones/i }));
    });

    expect(mockApi.score).toHaveBeenCalledWith("ones");
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
    const freshState = makeState({ rolls_used: 0, round: 1, total_score: 0 });
    mockApi.newGame.mockResolvedValue(freshState);
    const { getByRole, getByText } = renderScreen({ game_over: true, total_score: 100 });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /play again/i }));
    });
    expect(mockApi.newGame).toHaveBeenCalled();
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
