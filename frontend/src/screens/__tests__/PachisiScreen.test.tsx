import React from "react";
import { ActivityIndicator } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import PachisiScreen from "../PachisiScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
jest.mock("../../game/pachisi/api", () => ({
  pachisiApi: {
    newSession: jest.fn(),
    getState: jest.fn(),
    roll: jest.fn(),
    move: jest.fn(),
    newGame: jest.fn(),
  },
}));

import { pachisiApi } from "../../game/pachisi/api";
const mockApi = pachisiApi as jest.Mocked<typeof pachisiApi>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePieces(count = 4) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: -1,
    is_home: true,
    is_finished: false,
  }));
}

function makePlayerStates() {
  return [
    { player_id: "red", pieces: makePieces(), pieces_home: 4, pieces_finished: 0 },
    { player_id: "yellow", pieces: makePieces(), pieces_home: 4, pieces_finished: 0 },
  ];
}

function makeRollState(overrides = {}) {
  return {
    phase: "roll",
    players: ["red", "yellow"],
    current_player: "red",
    die_value: null,
    valid_moves: [],
    player_states: makePlayerStates(),
    winner: null,
    extra_turn: false,
    cpu_player: "yellow",
    last_event: null,
    ...overrides,
  };
}

function makeMoveState(overrides = {}) {
  return makeRollState({
    phase: "move",
    die_value: 6,
    valid_moves: [0, 1],
    ...overrides,
  });
}

function makeGameOverState(winner = "red") {
  return makeRollState({ phase: "game_over", winner });
}

function mockNav() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as Parameters<typeof PachisiScreen>[0]["navigation"];
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <PachisiScreen navigation={nav} />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PachisiScreen — initial load", () => {
  it("shows loading indicator while session is being created", async () => {
    let resolve!: (v: ReturnType<typeof makeRollState>) => void;
    mockApi.newSession.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy());
    await act(async () => {
      resolve(makeRollState());
    });
  });

  it("shows Roll button after session loads with roll phase", async () => {
    mockApi.newSession.mockResolvedValue(makeRollState());
    const { findByText } = renderScreen();
    await findByText("Roll");
  });

  it("calls newSession on mount", async () => {
    mockApi.newSession.mockResolvedValue(makeRollState());
    renderScreen();
    await waitFor(() => expect(mockApi.newSession).toHaveBeenCalledTimes(1));
  });

  it("renders header after newSession fails (error state)", async () => {
    mockApi.newSession.mockRejectedValue(new Error("Connection error"));
    const { findByText } = renderScreen();
    // Screen still renders header; error is not shown until state is loaded
    await findByText("Pachisi");
  });
});

describe("PachisiScreen — roll", () => {
  it("calls pachisiApi.roll when Roll button pressed", async () => {
    mockApi.newSession.mockResolvedValue(makeRollState());
    mockApi.roll.mockResolvedValue(makeRollState({ die_value: 3 }));
    const { findByText } = renderScreen();
    const rollBtn = await findByText("Roll");
    fireEvent.press(rollBtn);
    await waitFor(() => expect(mockApi.roll).toHaveBeenCalledTimes(1));
  });

  it("shows PieceSelector when valid_moves has more than 1 entry", async () => {
    mockApi.newSession.mockResolvedValue(makeRollState());
    mockApi.roll.mockResolvedValue(makeMoveState({ valid_moves: [0, 2] }));
    const { findByText } = renderScreen();
    const rollBtn = await findByText("Roll");
    fireEvent.press(rollBtn);
    await findByText("Move Piece 1");
    await findByText("Move Piece 3");
  });
});

describe("PachisiScreen — auto-move", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("auto-moves after 600ms when only one valid move exists", async () => {
    mockApi.newSession.mockResolvedValue(makeRollState());
    mockApi.roll.mockResolvedValue(makeMoveState({ valid_moves: [2] }));
    mockApi.move.mockResolvedValue(makeRollState());

    const { findByText } = renderScreen();
    const rollBtn = await findByText("Roll");
    fireEvent.press(rollBtn);
    await waitFor(() => expect(mockApi.roll).toHaveBeenCalled());

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(mockApi.move).toHaveBeenCalledWith(2));
  });
});

describe("PachisiScreen — game over", () => {
  it('shows "You Win!" modal when human wins', async () => {
    mockApi.newSession.mockResolvedValue(makeGameOverState("red"));
    const { findByText } = renderScreen();
    await findByText("You Win!");
  });

  it('shows "CPU Wins!" modal when cpu wins', async () => {
    mockApi.newSession.mockResolvedValue(makeGameOverState("yellow"));
    const { findByText } = renderScreen();
    await findByText("CPU Wins!");
  });
});
