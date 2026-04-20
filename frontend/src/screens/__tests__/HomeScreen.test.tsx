import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "../HomeScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Mock yacht storage — no saved game by default
// ---------------------------------------------------------------------------
jest.mock("../../game/yacht/storage", () => ({
  loadGame: jest.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Mock navigation
// ---------------------------------------------------------------------------
const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    isFocused: jest.fn().mockReturnValue(true),
    canGoBack: jest.fn().mockReturnValue(false),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    setParams: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
    setOptions: jest.fn(),
    getId: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testInsets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

function renderScreen(windowWidth = 390) {
  jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    width: windowWidth,
    height: 844,
    scale: 2,
    fontScale: 1,
  });
  return render(
    <SafeAreaProvider initialMetrics={testInsets}>
      <ThemeProvider>
        <HomeScreen />
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
  it("renders active game cards (Pachisi disabled)", () => {
    const { getByLabelText, queryByLabelText } = renderScreen();
    expect(getByLabelText("Play Yacht")).toBeTruthy();
    expect(getByLabelText("Play Cascade")).toBeTruthy();
    expect(getByLabelText("Play Blackjack")).toBeTruthy();
    expect(getByLabelText("Play Solitaire")).toBeTruthy();
    // Pachisi is disabled — should not appear
    expect(queryByLabelText("Play Pachisi")).toBeNull();
  });

  it("navigates to Blackjack when Blackjack card pressed", () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText("Play Blackjack"));
    expect(mockNavigate).toHaveBeenCalledWith("BlackjackBetting");
  });

  it("navigates to Cascade when Cascade card pressed", () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText("Play Cascade"));
    expect(mockNavigate).toHaveBeenCalledWith("Cascade");
  });

  it("navigates to Solitaire when Solitaire card pressed", () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText("Play Solitaire"));
    expect(mockNavigate).toHaveBeenCalledWith("Solitaire");
  });

  it("navigates to Game with a new state when Yacht card pressed (no saved game)", async () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText("Play Yacht"));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "Game",
        expect.objectContaining({
          initialState: expect.objectContaining({
            round: 1,
            rolls_used: 0,
            game_over: false,
          }),
        })
      )
    );
  });
});

describe("HomeScreen — AppHeader", () => {
  it("renders AppHeader with app title", () => {
    const { getByRole } = renderScreen();
    expect(getByRole("header")).toBeTruthy();
  });
});

describe("HomeScreen — responsive layout (Galaxy Fold fix, #356)", () => {
  it("renders all game cards at 280 px viewport width", () => {
    const { getByLabelText } = renderScreen(280);
    expect(getByLabelText("Play Yacht")).toBeTruthy();
    expect(getByLabelText("Play Cascade")).toBeTruthy();
    expect(getByLabelText("Play Blackjack")).toBeTruthy();
    expect(getByLabelText("Play 2048")).toBeTruthy();
    expect(getByLabelText("Play Solitaire")).toBeTruthy();
  });

  it("renders all game cards at 360 px viewport width", () => {
    const { getByLabelText } = renderScreen(360);
    expect(getByLabelText("Play Yacht")).toBeTruthy();
    expect(getByLabelText("Play Cascade")).toBeTruthy();
    expect(getByLabelText("Play Blackjack")).toBeTruthy();
    expect(getByLabelText("Play 2048")).toBeTruthy();
    expect(getByLabelText("Play Solitaire")).toBeTruthy();
  });
});
