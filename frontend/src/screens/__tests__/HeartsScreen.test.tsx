import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import HeartsScreen from "../HeartsScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { HeartsRoundsProvider } from "../../game/hearts/RoundsContext";
import { createSeededRng, setRng } from "../../game/hearts/engine";
import * as engine from "../../game/hearts/engine";
import { loadGame } from "../../game/hearts/storage";

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

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: mockNavigate,
    addListener: jest.fn(() => jest.fn()),
  }),
  // No-op stub: blur-time save behavior is verified via manual TESTING.md repro.
  useFocusEffect: jest.fn(),
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
      <HeartsRoundsProvider>
        <HeartsScreen />
      </HeartsRoundsProvider>
    </ThemeProvider>
  );
}

describe("HeartsScreen — passing phase (inline banner)", () => {
  beforeEach(() => {
    setRng(createSeededRng(42));
    // Provide a saved game in passing phase so the screen skips the pre-game picker.
    (loadGame as jest.Mock).mockResolvedValue(engine.dealGame());
  });

  afterEach(() => {
    (loadGame as jest.Mock).mockResolvedValue(null);
  });

  it("shows inline banner with direction instruction", async () => {
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/pass left/i)).toBeTruthy());
  });

  it("confirm button starts disabled (no cards selected)", async () => {
    const { getByRole } = renderScreen();
    await waitFor(() => {
      const btn = getByRole("button", { name: /confirm/i });
      expect(btn.props.accessibilityState.disabled).toBe(true);
    });
  });

  it("renders no Modal during passing phase", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Modal } = require("react-native");
    const { UNSAFE_queryAllByType } = renderScreen();
    await waitFor(() => {
      const visibleModals = UNSAFE_queryAllByType(Modal).filter(
        (m: { props: { visible?: boolean } }) => m.props.visible !== false
      );
      expect(visibleModals).toHaveLength(0);
    });
  });

  it("tapping a card increments the selection counter", async () => {
    const { getByText, queryAllByRole } = renderScreen();
    await waitFor(() => expect(getByText(/0 of 3 selected/i)).toBeTruthy());
    const cardBtns = queryAllByRole("button").filter(
      (el) =>
        typeof el.props.accessibilityLabel === "string" &&
        /of\s+\w+/i.test(el.props.accessibilityLabel)
    );
    expect(cardBtns.length).toBeGreaterThan(0);
    fireEvent.press(cardBtns[0]!);
    expect(getByText(/1 of 3 selected/i)).toBeTruthy();
  });

  it("unmounts cleanly while AI loop is pending", async () => {
    const { unmount } = renderScreen();
    await waitFor(() => expect(loadGame).toHaveBeenCalled());
    act(() => {
      jest.runAllTimers();
    });
    expect(() => unmount()).not.toThrow();
  });
});

describe("HeartsScreen — playing phase (no modal)", () => {
  function makePlayingState() {
    setRng(createSeededRng(42));
    const realState = engine.dealGame();
    return {
      ...realState,
      phase: "playing" as const,
      passDirection: "none" as const,
      passingComplete: true,
      currentPlayerIndex: 0,
    };
  }

  beforeEach(() => {
    (loadGame as jest.Mock).mockResolvedValue(makePlayingState());
  });

  afterEach(() => {
    (loadGame as jest.Mock).mockResolvedValue(null);
  });

  it("renders the Hearts title in the header", async () => {
    const { getAllByText } = renderScreen();
    await waitFor(() => expect(getAllByText("Hearts").length).toBeGreaterThan(0));
  });

  it("⋯ menu Scoreboard item navigates to ScoreboardScreen with hearts gameKey", async () => {
    mockNavigate.mockClear();
    const { getByLabelText, getByText } = renderScreen();
    await waitFor(() => getByLabelText("More options"));
    fireEvent.press(getByLabelText("More options")); // open ⋯ menu
    fireEvent.press(getByText("Scoreboard")); // tap Scoreboard item
    expect(mockNavigate).toHaveBeenCalledWith("Scoreboard", { gameKey: "hearts" });
  });

  it("⋯ menu Edit Names item opens the rename modal", async () => {
    const { getByLabelText, getByText } = renderScreen();
    await waitFor(() => getByLabelText("More options"));
    fireEvent.press(getByLabelText("More options")); // open ⋯ menu
    fireEvent.press(getByText("Edit Names")); // tap Edit Names item
    // Rename modal title is in hearts.json under settings.rename_title
    expect(getByText("Player Names")).toBeTruthy();
  });

  it("human hand cards are rendered", async () => {
    const { queryAllByRole } = renderScreen();
    await waitFor(() => {
      const cardBtns = queryAllByRole("button").filter(
        (el) =>
          el.props.accessibilityLabel &&
          !["More options", "Go back to home screen"].includes(el.props.accessibilityLabel)
      );
      expect(cardBtns.length).toBeGreaterThan(0);
    });
  });

  it("does not render numeric score badges next to seat labels during play", async () => {
    // Override with distinct non-trivial scores so any score rendered next to a
    // seat label would be clearly visible — and clearly not a card rank (1–13).
    const stateWithScores = {
      ...makePlayingState(),
      cumulativeScores: [59, 25, 41, 17],
    };
    (loadGame as jest.Mock).mockResolvedValue(stateWithScores);

    const { queryByText } = renderScreen();
    await waitFor(() => expect(queryByText("59")).toBeNull());
    expect(queryByText("25")).toBeNull();
    expect(queryByText("41")).toBeNull();
    expect(queryByText("17")).toBeNull();
  });
});
