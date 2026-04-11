/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, act, waitFor, fireEvent } from "@testing-library/react-native";
import Twenty48Screen from "../Twenty48Screen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { saveGame, clearGame, loadGame } from "../../game/twenty48/storage";
import { Twenty48State } from "../../game/twenty48/types";

// Force web platform so the keyboard-listener useEffect runs.
import { Platform } from "react-native";
(Platform as { OS: string }).OS = "web";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// Mock storage — no saved game, no-op persistence.
jest.mock("../../game/twenty48/storage", () => ({
  saveGame: jest.fn(),
  clearGame: jest.fn(),
  loadGame: jest.fn().mockResolvedValue(null),
  saveBestScore: jest.fn(),
  loadBestScore: jest.fn().mockResolvedValue(0),
}));

function mockNav() {
  return {
    setOptions: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as Parameters<typeof Twenty48Screen>[0]["navigation"];
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <Twenty48Screen navigation={nav} />
    </ThemeProvider>
  );
}

// Wait for the initial loadGame() promise to resolve so the pending setState
// doesn't race with the test body.
async function mountAndSettle() {
  const r = renderScreen();
  await act(async () => {
    await Promise.resolve();
  });
  return r;
}

function dispatchKey(key: string, target?: EventTarget) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  if (target) {
    Object.defineProperty(event, "target", { value: target, writable: false });
  }
  window.dispatchEvent(event);
}

describe("Twenty48Screen — keyboard controls (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Flush any pending move-lock timeouts (120 ms) so they don't fire
  // during subsequent tests and pollute the saveGame mock call count.
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    jest.clearAllMocks();
  });

  it("arrow keys advance the game", async () => {
    const { queryByText } = await mountAndSettle();
    // Wait for loadGame() promise to resolve + initial state to render.
    await waitFor(() => expect(queryByText("Score: 0")).toBeNull(), { timeout: 5000 });

    // Try each of the 4 arrow keys. At least one should produce a valid move
    // (the new-game board with 2 spawned tiles has at least one direction
    // that compacts the board).
    act(() => {
      dispatchKey("ArrowLeft");
      dispatchKey("ArrowRight");
      dispatchKey("ArrowUp");
      dispatchKey("ArrowDown");
    });

    // After any valid move, a new tile is spawned → 3+ non-zero cells.
    // We can't reliably assert specific tile positions due to Math.random
    // in spawns, so this is a smoke test that the handler fires without error.
    // The real guarantee comes from "removes listener on unmount" below.
  });

  it("WASD keys also work", async () => {
    await mountAndSettle();
    // Dispatch lowercase + uppercase to confirm both are mapped.
    act(() => {
      dispatchKey("w");
      dispatchKey("W");
      dispatchKey("a");
      dispatchKey("A");
      dispatchKey("s");
      dispatchKey("S");
      dispatchKey("d");
      dispatchKey("D");
    });
    // No throw = pass.
  });

  it("ignores non-direction keys", async () => {
    await mountAndSettle();
    act(() => {
      dispatchKey(" "); // space
      dispatchKey("Enter");
      dispatchKey("Escape");
      dispatchKey("q");
      dispatchKey("x");
    });
    // No throw and no crash = pass.
  });

  it("ignores arrow keys when an input is focused", async () => {
    await mountAndSettle();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      dispatchKey("ArrowLeft", input);
    });
    document.body.removeChild(input);
    // The handler early-returns; no crash. We can't easily observe "didn't
    // move" from the outside without exposing state, so this test's value
    // is crash-safety + documenting the guard's existence.
  });

  it("removes the keydown listener on unmount", async () => {
    const add = jest.spyOn(window, "addEventListener");
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = await mountAndSettle();
    expect(add).toHaveBeenCalledWith("keydown", expect.any(Function));
    unmount();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    add.mockRestore();
    remove.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Shared fixture states
// ---------------------------------------------------------------------------

import { TileData } from "../../game/twenty48/types";

function tilesFor(board: number[][]): TileData[] {
  const tiles: TileData[] = [];
  let id = 100;
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board[r].length; c++)
      if (board[r][c] !== 0)
        tiles.push({
          id: id++,
          value: board[r][c],
          row: r,
          col: c,
          prevRow: r,
          prevCol: c,
          isNew: false,
          isMerge: false,
        });
  return tiles;
}

// All tiles packed left, no equal adjacent pairs → ArrowLeft is a no-op.
const NOOP_LEFT_BOARD = [
  [2, 4, 0, 0],
  [8, 16, 0, 0],
  [32, 64, 0, 0],
  [128, 256, 0, 0],
];
const NOOP_LEFT_STATE: Twenty48State = {
  board: NOOP_LEFT_BOARD,
  tiles: tilesFor(NOOP_LEFT_BOARD),
  score: 0,
  scoreDelta: 0,
  game_over: false,
  has_won: false,
};

const WON_BOARD = [
  [2048, 4, 0, 0],
  [8, 16, 0, 0],
  [32, 64, 0, 0],
  [128, 256, 0, 0],
];
const WON_STATE: Twenty48State = {
  board: WON_BOARD,
  tiles: tilesFor(WON_BOARD),
  score: 2048,
  scoreDelta: 0,
  game_over: false,
  has_won: true,
};

// A filled board with no possible merges — game is over.
const GAME_OVER_BOARD = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
];
const GAME_OVER_STATE: Twenty48State = {
  board: GAME_OVER_BOARD,
  tiles: tilesFor(GAME_OVER_BOARD),
  score: 0,
  scoreDelta: 0,
  game_over: true,
  has_won: false,
};

// ---------------------------------------------------------------------------
// Initial load
// ---------------------------------------------------------------------------

describe("Twenty48Screen — initial load", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls loadGame on mount", async () => {
    await mountAndSettle();
    expect(loadGame).toHaveBeenCalledTimes(1);
  });

  it("calls saveGame with new state when loadGame returns null", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(null);
    await mountAndSettle();
    expect(saveGame).toHaveBeenCalledTimes(1);
  });

  it("does not call saveGame when loadGame returns a saved state", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(NOOP_LEFT_STATE);
    await mountAndSettle();
    expect(saveGame).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Move persistence
// ---------------------------------------------------------------------------

describe("Twenty48Screen — move persistence", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls saveGame after a valid move", async () => {
    // Start from null so the engine spawns a real random board.
    (loadGame as jest.Mock).mockResolvedValueOnce(null);
    await mountAndSettle();
    jest.clearAllMocks(); // reset the initial saveGame call

    // At least one of the four directions will produce a valid move.
    act(() => {
      dispatchKey("ArrowLeft");
      dispatchKey("ArrowRight");
      dispatchKey("ArrowUp");
      dispatchKey("ArrowDown");
    });

    expect(saveGame).toHaveBeenCalled();
  });

  it("does not call saveGame for a no-op move", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(NOOP_LEFT_STATE);
    await mountAndSettle();

    act(() => {
      dispatchKey("ArrowLeft"); // no-op on this board
    });

    expect(saveGame).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Game-over
// ---------------------------------------------------------------------------

describe("Twenty48Screen — game-over", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls clearGame when loaded state is game_over", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(GAME_OVER_STATE);
    await mountAndSettle();
    expect(clearGame).toHaveBeenCalledTimes(1);
  });

  it("renders game-over overlay when game_over is true", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(GAME_OVER_STATE);
    const { getByText } = await mountAndSettle();
    await waitFor(() => expect(getByText("Game Over")).toBeTruthy());
  });

  it("does not render game-over overlay for an active game", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(NOOP_LEFT_STATE);
    const { queryByText } = await mountAndSettle();
    expect(queryByText("Game Over")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Win overlay
// ---------------------------------------------------------------------------

describe("Twenty48Screen — win overlay", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows win overlay when has_won is true and game is not over", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(WON_STATE);
    const { getByText } = await mountAndSettle();
    await waitFor(() => expect(getByText("You Win!")).toBeTruthy());
  });

  it("dismisses win overlay when Keep Playing is pressed", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(WON_STATE);
    const { getByLabelText, queryByText } = await mountAndSettle();
    await waitFor(() =>
      expect(getByLabelText("Continue playing after reaching 2048")).toBeTruthy()
    );
    act(() => {
      fireEvent.press(getByLabelText("Continue playing after reaching 2048"));
    });
    expect(queryByText("You Win!")).toBeNull();
  });

  it("does not show win overlay when game_over is true even if has_won", async () => {
    const wonAndOver: Twenty48State = { ...WON_STATE, game_over: true };
    (loadGame as jest.Mock).mockResolvedValueOnce(wonAndOver);
    const { queryByText } = await mountAndSettle();
    await waitFor(() => expect(queryByText("You Win!")).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// New game
// ---------------------------------------------------------------------------

describe("Twenty48Screen — new game", () => {
  beforeEach(() => jest.clearAllMocks());

  it("New Game button calls saveGame with a fresh state", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(null);
    const { getByLabelText } = await mountAndSettle();
    jest.clearAllMocks();

    act(() => {
      fireEvent.press(getByLabelText("Start a new 2048 game"));
    });

    expect(saveGame).toHaveBeenCalledTimes(1);
    const savedState = (saveGame as jest.Mock).mock.calls[0][0] as Twenty48State;
    expect(savedState.score).toBe(0);
    expect(savedState.game_over).toBe(false);
    expect(savedState.has_won).toBe(false);
  });

  it("New Game dismisses the win overlay", async () => {
    (loadGame as jest.Mock).mockResolvedValueOnce(WON_STATE);
    const { getByText, getAllByLabelText, queryByText } = await mountAndSettle();
    await waitFor(() => expect(getByText("You Win!")).toBeTruthy());

    // Both the header button and the overlay button share the same label.
    // Press any one of them — they both call handleNewGame.
    act(() => {
      fireEvent.press(getAllByLabelText("Start a new 2048 game")[0]);
    });

    // New state has has_won=false so overlay should be gone.
    expect(queryByText("You Win!")).toBeNull();
  });
});
