import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import BlackjackScreen from "../BlackjackScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
jest.mock("../../api/blackjackClient", () => ({
  blackjackApi: {
    newSession: jest.fn(),
    getState: jest.fn(),
    placeBet: jest.fn(),
    hit: jest.fn(),
    stand: jest.fn(),
    doubleDown: jest.fn(),
    newHand: jest.fn(),
  },
}));

import { blackjackApi } from "../../api/blackjackClient";
const mockApi = blackjackApi as jest.Mocked<typeof blackjackApi>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyHand = { cards: [], value: 0 };

function makeBettingState(overrides = {}) {
  return {
    phase: "betting",
    chips: 1000,
    bet: 0,
    player_hand: emptyHand,
    dealer_hand: emptyHand,
    outcome: null,
    payout: 0,
    game_over: false,
    double_down_available: false,
    ...overrides,
  };
}

function makePlayerState(overrides = {}) {
  return makeBettingState({
    phase: "player",
    bet: 100,
    chips: 900,
    player_hand: {
      cards: [
        { rank: "7", suit: "♠", face_down: false },
        { rank: "8", suit: "♥", face_down: false },
      ],
      value: 15,
    },
    dealer_hand: {
      cards: [
        { rank: "?", suit: "?", face_down: true },
        { rank: "9", suit: "♦", face_down: false },
      ],
      value: 0,
    },
    double_down_available: true,
    ...overrides,
  });
}

function makeResultState(overrides = {}) {
  return makeBettingState({
    phase: "result",
    bet: 100,
    chips: 1100,
    player_hand: {
      cards: [
        { rank: "7", suit: "♠", face_down: false },
        { rank: "8", suit: "♥", face_down: false },
      ],
      value: 15,
    },
    dealer_hand: {
      cards: [
        { rank: "6", suit: "♦", face_down: false },
        { rank: "9", suit: "♣", face_down: false },
      ],
      value: 15,
    },
    outcome: "win",
    payout: 100,
    ...overrides,
  });
}

function mockNav() {
  return { navigate: jest.fn() } as unknown as Parameters<typeof BlackjackScreen>[0]["navigation"];
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <BlackjackScreen navigation={nav} />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlackjackScreen — initial load", () => {
  it("shows loading indicator while session is being created", async () => {
    let resolve!: (v: ReturnType<typeof makeBettingState>) => void;
    mockApi.newSession.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { UNSAFE_getByType } = renderScreen();
    const { ActivityIndicator } = require("react-native");
    await waitFor(() => expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy());
    // clean up
    await act(async () => { resolve(makeBettingState()); });
  });

  it("renders BettingPanel after session created", async () => {
    mockApi.newSession.mockResolvedValue(makeBettingState());
    const { findByText } = renderScreen();
    await findByText("Deal");
  });

  it("shows error if newSession fails", async () => {
    mockApi.newSession.mockRejectedValue(new Error("Network error"));
    const { findByText } = renderScreen();
    await findByText(/connect|network|error/i);
  });
});

describe("BlackjackScreen — betting phase", () => {
  it("calls placeBet when Deal is pressed", async () => {
    mockApi.newSession.mockResolvedValue(makeBettingState());
    mockApi.placeBet.mockResolvedValue(makePlayerState());
    const { findByText } = renderScreen();
    const dealBtn = await findByText("Deal");
    await act(async () => { fireEvent.press(dealBtn); });
    expect(mockApi.placeBet).toHaveBeenCalledTimes(1);
  });
});

describe("BlackjackScreen — player phase", () => {
  it("renders Hit and Stand buttons", async () => {
    mockApi.newSession.mockResolvedValue(makePlayerState());
    const { findByText } = renderScreen();
    await findByText("Hit");
    await findByText("Stand");
  });

  it("calls hit() when Hit is pressed", async () => {
    mockApi.newSession.mockResolvedValue(makePlayerState());
    mockApi.hit.mockResolvedValue(makePlayerState());
    const { findByText } = renderScreen();
    const hitBtn = await findByText("Hit");
    await act(async () => { fireEvent.press(hitBtn); });
    expect(mockApi.hit).toHaveBeenCalledTimes(1);
  });

  it("calls stand() when Stand is pressed", async () => {
    mockApi.newSession.mockResolvedValue(makePlayerState());
    mockApi.stand.mockResolvedValue(makeResultState());
    const { findByText } = renderScreen();
    const standBtn = await findByText("Stand");
    await act(async () => { fireEvent.press(standBtn); });
    expect(mockApi.stand).toHaveBeenCalledTimes(1);
  });

  it("calls doubleDown() when Double Down is pressed", async () => {
    mockApi.newSession.mockResolvedValue(makePlayerState({ double_down_available: true }));
    mockApi.doubleDown.mockResolvedValue(makeResultState());
    const { findByText } = renderScreen();
    const ddBtn = await findByText("Double Down");
    await act(async () => { fireEvent.press(ddBtn); });
    expect(mockApi.doubleDown).toHaveBeenCalledTimes(1);
  });

  it("Double Down button is disabled when double_down_available is false", async () => {
    mockApi.newSession.mockResolvedValue(makePlayerState({ double_down_available: false }));
    const { findByRole } = renderScreen();
    // Wait for screen to render
    await findByRole("button", { name: /double down not available/i });
  });
});

describe("BlackjackScreen — result phase", () => {
  it("shows outcome text in result phase", async () => {
    mockApi.newSession.mockResolvedValue(makeResultState({ outcome: "win" }));
    const { findByText } = renderScreen();
    await findByText("You Win!");
  });

  it("shows Next Hand button in result phase", async () => {
    mockApi.newSession.mockResolvedValue(makeResultState());
    const { findByText } = renderScreen();
    await findByText("Next Hand");
  });

  it("calls newHand() when Next Hand is pressed", async () => {
    mockApi.newSession.mockResolvedValue(makeResultState());
    mockApi.newHand.mockResolvedValue(makeBettingState());
    const { findByText } = renderScreen();
    const btn = await findByText("Next Hand");
    await act(async () => { fireEvent.press(btn); });
    expect(mockApi.newHand).toHaveBeenCalledTimes(1);
  });
});

describe("BlackjackScreen — game over", () => {
  it("shows GameOverModal when game_over is true", async () => {
    mockApi.newSession.mockResolvedValue(makeResultState({ game_over: true, chips: 0 }));
    const { findByText } = renderScreen();
    await findByText("Out of Chips");
  });

  it("calls newSession when Play Again is pressed", async () => {
    mockApi.newSession.mockResolvedValue(makeResultState({ game_over: true, chips: 0 }));
    const { findByText } = renderScreen();
    const btn = await findByText("Play Again");
    await act(async () => { fireEvent.press(btn); });
    // newSession called once for mount + once for play again
    expect(mockApi.newSession).toHaveBeenCalledTimes(2);
  });
});
