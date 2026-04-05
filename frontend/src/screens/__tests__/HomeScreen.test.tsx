import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "../HomeScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock yacht storage — no saved game by default
// ---------------------------------------------------------------------------
jest.mock("../../game/yacht/storage", () => ({
  loadGame: jest.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockNav() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as Parameters<typeof HomeScreen>[0]["navigation"];
}

const testInsets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

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
    expect(getByLabelText("Play Yacht")).toBeTruthy();
    expect(getByLabelText("Play Cascade")).toBeTruthy();
    expect(getByLabelText("Play Blackjack")).toBeTruthy();
    expect(getByLabelText("Play Pachisi")).toBeTruthy();
  });

  it("navigates to Blackjack when Blackjack card pressed", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Blackjack"));
    expect(nav.navigate).toHaveBeenCalledWith("Blackjack");
  });

  it("navigates to Cascade when Cascade card pressed", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Cascade"));
    expect(nav.navigate).toHaveBeenCalledWith("Cascade");
  });

  it("navigates to Pachisi when Pachisi card pressed", () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Pachisi"));
    expect(nav.navigate).toHaveBeenCalledWith("Pachisi");
  });

  it("navigates to Game with a new state when Yacht card pressed (no saved game)", async () => {
    const nav = mockNav();
    const { getByLabelText } = renderScreen(nav);
    fireEvent.press(getByLabelText("Play Yacht"));
    await waitFor(() =>
      expect(nav.navigate).toHaveBeenCalledWith(
        "Game",
        expect.objectContaining({
          initialState: expect.objectContaining({ round: 1, rolls_used: 0, game_over: false }),
        })
      )
    );
  });
});
