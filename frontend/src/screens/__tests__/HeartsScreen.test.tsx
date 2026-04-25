import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import HeartsScreen from "../HeartsScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { createSeededRng, setRng } from "../../game/hearts/engine";
import * as engine from "../../game/hearts/engine";

jest.mock("../../game/hearts/storage", () => ({
  loadGame: jest.fn().mockResolvedValue(null),
  saveGame: jest.fn().mockResolvedValue(undefined),
  clearGame: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../game/hearts/playerNames", () => ({
  DEFAULT_NAMES: ["You", "West", "North", "East"],
  loadPlayerNames: jest.fn().mockResolvedValue(["You", "West", "North", "East"]),
  savePlayerNames: jest.fn().mockResolvedValue(undefined),
  validateName: jest.fn((v: string, def: string) => v.trim() || def),
}));

jest.mock("../../game/hearts/api", () => ({
  heartsApi: {
    submitScore: jest.fn().mockResolvedValue({ player_name: "test", score: 0, rank: 1 }),
  },
}));

jest.mock("../../game/_shared/useGameSync", () => ({
  useGameSync: () => ({
    start: jest.fn(),
    markStarted: jest.fn(),
    complete: jest.fn(),
    restart: jest.fn(),
    getGameId: jest.fn().mockReturnValue(null),
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
}));

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.useFakeTimers();

function renderScreen() {
  return render(
    <ThemeProvider>
      <HeartsScreen />
    </ThemeProvider>
  );
}

describe("HeartsScreen — passing phase (inline banner)", () => {
  beforeEach(() => {
    setRng(createSeededRng(42));
  });

  it("shows inline banner with direction instruction", () => {
    const { getByText } = renderScreen();
    expect(getByText(/pass left/i)).toBeTruthy();
  });

  it("confirm button starts disabled (no cards selected)", () => {
    const { getByRole } = renderScreen();
    const btn = getByRole("button", { name: /confirm/i });
    expect(btn.props.accessibilityState.disabled).toBe(true);
  });

  it("renders no Modal during passing phase", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Modal } = require("react-native");
    const { UNSAFE_queryAllByType } = renderScreen();
    const visibleModals = UNSAFE_queryAllByType(Modal).filter(
      (m: { props: { visible?: boolean } }) => m.props.visible !== false
    );
    expect(visibleModals).toHaveLength(0);
  });

  it("tapping a card increments the selection counter", () => {
    const { getByText, queryAllByRole } = renderScreen();
    expect(getByText(/0 of 3 selected/i)).toBeTruthy();
    const cardBtns = queryAllByRole("button").filter(
      (el) =>
        typeof el.props.accessibilityLabel === "string" &&
        /of\s+\w+/i.test(el.props.accessibilityLabel)
    );
    expect(cardBtns.length).toBeGreaterThan(0);
    fireEvent.press(cardBtns[0]!);
    expect(getByText(/1 of 3 selected/i)).toBeTruthy();
  });

  it("unmounts cleanly while AI loop is pending", () => {
    const { unmount } = renderScreen();
    act(() => {
      jest.runAllTimers();
    });
    expect(() => unmount()).not.toThrow();
  });
});

describe("HeartsScreen — playing phase (no modal)", () => {
  let dealGameSpy: jest.SpyInstance;

  beforeEach(() => {
    setRng(createSeededRng(42));
    // Produce a real deal, then override phase to "playing" so no overlay blocks.
    const realState = engine.dealGame();
    const playingState = {
      ...realState,
      phase: "playing" as const,
      passDirection: "none" as const,
      passingComplete: true,
      currentPlayerIndex: 0,
    };
    dealGameSpy = jest.spyOn(engine, "dealGame").mockReturnValue(playingState);
  });

  afterEach(() => {
    dealGameSpy.mockRestore();
  });

  it("renders the Hearts title in the header", () => {
    const { getAllByText } = renderScreen();
    expect(getAllByText("Hearts").length).toBeGreaterThan(0);
  });

  it("score panel opens and shows score board", () => {
    const { getByLabelText, getByText } = renderScreen();
    fireEvent.press(getByLabelText("More options")); // open ⋯ menu
    fireEvent.press(getByText("Scoreboard")); // tap Scoreboard item
    expect(getByText("Total")).toBeTruthy(); // ScoreBoard total row header
  });

  it("score panel close button dismisses the panel", () => {
    const { getByLabelText, queryByLabelText, getByText } = renderScreen();
    fireEvent.press(getByLabelText("More options")); // open ⋯ menu
    fireEvent.press(getByText("Scoreboard")); // tap Scoreboard item
    expect(getByLabelText("Close")).toBeTruthy();
    fireEvent.press(getByLabelText("Close"));
    expect(queryByLabelText("Close")).toBeNull();
  });

  it("human hand cards are rendered", () => {
    const { queryAllByRole } = renderScreen();
    // Cards with onPress are buttons; there should be some (13 cards in hand)
    const cardBtns = queryAllByRole("button").filter(
      (el) =>
        el.props.accessibilityLabel &&
        !["More options", "Go back to home screen"].includes(el.props.accessibilityLabel)
    );
    expect(cardBtns.length).toBeGreaterThan(0);
  });
});
