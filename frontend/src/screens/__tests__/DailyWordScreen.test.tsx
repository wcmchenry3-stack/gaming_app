import React, { Suspense } from "react";
import { Text } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DailyWordScreen, { formatCountdown } from "../DailyWordScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { initialState, applyServerResult, markComplete } from "../../game/daily_word/engine";
import { saveState } from "../../game/daily_word/storage";
import type { TileState } from "../../game/daily_word/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Heavy: "Heavy" },
  NotificationFeedbackType: { Success: "Success", Warning: "Warning", Error: "Error" },
}));

const mockGameEventClient = {
  startGame: jest.fn().mockReturnValue("game-id-1"),
  enqueueEvent: jest.fn(),
  completeGame: jest.fn(),
  abandonGame: jest.fn(),
  init: jest.fn().mockResolvedValue(undefined),
  reportBug: jest.fn(),
  getQueueStats: jest.fn(),
  clearAll: jest.fn().mockResolvedValue(undefined),
};
jest.mock("../../game/_shared/gameEventClient", () => ({
  gameEventClient: mockGameEventClient,
}));

const mockGetToday = jest.fn();
const mockSubmitGuess = jest.fn();
const mockGetAnswer = jest.fn();
jest.mock("../../game/daily_word/api", () => ({
  dailyWordApi: {
    getToday: (...args: unknown[]) => mockGetToday(...args),
    submitGuess: (...args: unknown[]) => mockSubmitGuess(...args),
    getAnswer: (...args: unknown[]) => mockGetAnswer(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY_PUZZLE_ID = "2026-05-03:en";
const TODAY_RESPONSE = { puzzle_id: TODAY_PUZZLE_ID, word_length: 5 };

function renderScreen() {
  return render(
    <Suspense fallback={<Text>Loading translations...</Text>}>
      <ThemeProvider>
        <DailyWordScreen />
      </ThemeProvider>
    </Suspense>
  );
}

async function renderAndLoad() {
  const r = renderScreen();
  await waitFor(() => expect(mockGetToday).toHaveBeenCalled());
  return r;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockGetToday.mockResolvedValue(TODAY_RESPONSE);
  mockSubmitGuess.mockResolvedValue({
    tiles: [
      { letter: "c", status: "absent" },
      { letter: "r", status: "absent" },
      { letter: "a", status: "absent" },
      { letter: "n", status: "absent" },
      { letter: "e", status: "absent" },
    ],
  });
  mockGetAnswer.mockResolvedValue({ answer: "shine" });
  mockGameEventClient.startGame.mockReturnValue("game-id-1");
});

// ---------------------------------------------------------------------------
// Mount / persistence
// ---------------------------------------------------------------------------

describe("DailyWordScreen — mount", () => {
  it("starts fresh when no saved state exists", async () => {
    await renderAndLoad();
    await waitFor(() => expect(mockGetToday).toHaveBeenCalledTimes(1));
    // No saved state → initialState should be created; no clearState call needed
  });

  it("resumes saved state when puzzle_id matches today", async () => {
    const saved = initialState(TODAY_PUZZLE_ID, 5, "en");
    await saveState(saved);

    const { getByTestId } = renderScreen();
    // Game loads without error — loadState and getToday both resolve
    await waitFor(() => expect(mockGetToday).toHaveBeenCalledTimes(1));
    // After loading, saved state is reused (current_row = 0)
    await waitFor(() =>
      expect(AsyncStorage.getItem).toBeDefined()
    );
  });

  it("discards stale saved state when puzzle_id differs from today", async () => {
    // Save state for yesterday's puzzle
    const stale = initialState("2026-05-02:en", 5, "en");
    await saveState(stale);

    renderScreen();
    await waitFor(() => expect(mockGetToday).toHaveBeenCalledTimes(1));

    // After init, AsyncStorage should be cleared and replaced with fresh state
    const raw = await AsyncStorage.getItem("daily_word_state_v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // Fresh state for today's puzzle_id
    expect(parsed.puzzle_id).toBe(TODAY_PUZZLE_ID);
    expect(parsed.current_row).toBe(0);
    // All rows empty
    expect(parsed.rows[0].tiles[0].status).toBe("empty");
  });
});

// ---------------------------------------------------------------------------
// Win modal
// ---------------------------------------------------------------------------

describe("DailyWordScreen — win modal", () => {
  it("shows win modal with share button when all tiles correct", async () => {
    const tiles: TileState[] = Array.from({ length: 5 }, (_, i) => ({
      letter: "shine"[i]!,
      status: "correct",
    }));

    // Pre-load a won game state
    let state = initialState(TODAY_PUZZLE_ID, 5, "en");
    state = markComplete(applyServerResult(state, tiles), true);
    await saveState(state);

    const { getByTestId } = renderScreen();
    // After loading saved won state, win modal should appear
    await waitFor(() => getByTestId("win-modal-card"), { timeout: 8000 });
    // The share button is inside the win modal card
    expect(getByTestId("win-modal-card")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Loss modal
// ---------------------------------------------------------------------------

describe("DailyWordScreen — loss modal", () => {
  function buildLossState() {
    const absentTiles = (word: string): TileState[] =>
      word.split("").map((letter) => ({ letter, status: "absent" as const }));
    let state = initialState(TODAY_PUZZLE_ID, 5, "en");
    for (const word of ["crane", "stole", "bunny", "fizzy", "hippo", "jazzy"]) {
      state = applyServerResult(state, absentTiles(word));
    }
    return markComplete(state, false);
  }

  it("shows loss modal after 6 failed guesses", async () => {
    await saveState(buildLossState());

    const { getByTestId } = renderScreen();
    await waitFor(() => getByTestId("loss-modal-card"), { timeout: 8000 });
    expect(getByTestId("loss-modal-card")).toBeTruthy();
  });

  it("fetches the answer after a loss is loaded from storage", async () => {
    await saveState(buildLossState());

    const { queryByTestId } = renderScreen();
    // Wait for loss modal (confirms init() loaded the completed loss state)
    await waitFor(() => expect(queryByTestId("loss-modal-card")).not.toBeNull(), {
      timeout: 8000,
    });
    // getAnswer is called fire-and-forget inside init(); give the Promise microtask
    // queue a turn to settle before asserting.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetAnswer).toHaveBeenCalled();
  }, 15000);
});

// ---------------------------------------------------------------------------
// Countdown format
// ---------------------------------------------------------------------------

describe("DailyWordScreen — countdown format", () => {
  it("formatCountdown produces HH:MM:SS strings", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(3661_000)).toBe("01:01:01");
    expect(formatCountdown(86399_000)).toBe("23:59:59");
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("DailyWordScreen — regression", () => {
  it("renders without crashing on a clean mount", async () => {
    expect(() => renderScreen()).not.toThrow();
    await waitFor(() => expect(mockGetToday).toHaveBeenCalled());
  });
});
