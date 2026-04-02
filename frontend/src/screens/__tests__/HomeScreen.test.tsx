import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "../HomeScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock the Yahtzee API client
// ---------------------------------------------------------------------------
jest.mock("../../api/client", () => ({
  api: {
    newGame: jest.fn(),
  },
}));

import { api } from "../../api/client";
const mockApi = api as jest.Mocked<typeof api>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockNav() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as Parameters<typeof HomeScreen>[0]["navigation"];
}

const testInsets = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };

function renderScreen(nav = mockNav()) {
  return render(
    <SafeAreaProvider initialMetrics={testInsets}>
      <ThemeProvider>
        <HomeScreen navigation={nav} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HomeScreen — game cards", () => {
  it("renders all four game cards", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    expect(getByLabelText("Play Yahtzee")).toBeTruthy();
    expect(getByLabelText("Play Fruit Merge")).toBeTruthy();
    expect(getByLabelText("Play Blackjack")).toBeTruthy();
    expect(getByLabelText("Play Ludo")).toBeTruthy();
  });

  it("navigates to Blackjack when Blackjack card pressed", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Blackjack"));
    expect(nav.navigate).toHaveBeenCalledWith("Blackjack");
  });

  it("navigates to FruitMerge when Fruit Merge card pressed", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Fruit Merge"));
    expect(nav.navigate).toHaveBeenCalledWith("FruitMerge");
  });

  it("navigates to Ludo when Ludo card pressed", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Ludo"));
    expect(nav.navigate).toHaveBeenCalledWith("Ludo");
  });

  it("calls api.newGame and navigates to Game when Yahtzee card pressed", async () => {
    const nav = mockNav();
    mockApi.newGame.mockResolvedValue({
      dice: [1, 2, 3, 4, 5],
      held: [false, false, false, false, false],
      rolls_used: 0,
      round: 1,
      scores: {},
      game_over: false,
      upper_subtotal: 0,
      upper_bonus: 0,
      total_score: 0,
    });
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Yahtzee"));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith("Game", expect.any(Object)));
  });
});
