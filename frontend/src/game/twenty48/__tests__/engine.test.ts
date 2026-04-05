/**
 * Tests for the client-side 2048 engine.
 *
 * Ports backend/tests/test_twenty48_game.py so the two engines are
 * behaviorally identical.
 */

import {
  newGame,
  move,
  slideAndMerge,
  isGameOver,
  setRng,
  createSeededRng,
  SIZE,
  Direction,
} from "../engine";
import { Twenty48State } from "../types";

// Build a state with a specific board, bypassing random spawns.
function stateWith(board: number[][], overrides: Partial<Twenty48State> = {}): Twenty48State {
  return {
    board: board.map((r) => [...r]),
    score: 0,
    game_over: false,
    has_won: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// slideAndMerge — pure, no randomness
// ---------------------------------------------------------------------------

describe("slideAndMerge", () => {
  it("no merge when single tile", () => {
    const { line, score } = slideAndMerge([2, 0, 0, 0]);
    expect(line).toEqual([2, 0, 0, 0]);
    expect(score).toBe(0);
  });

  it("simple merge", () => {
    const { line, score } = slideAndMerge([2, 2, 0, 0]);
    expect(line).toEqual([4, 0, 0, 0]);
    expect(score).toBe(4);
  });

  it("slide then merge", () => {
    const { line, score } = slideAndMerge([0, 2, 0, 2]);
    expect(line).toEqual([4, 0, 0, 0]);
    expect(score).toBe(4);
  });

  it("no double merge — [2,2,2,2] → [4,4,0,0]", () => {
    const { line, score } = slideAndMerge([2, 2, 2, 2]);
    expect(line).toEqual([4, 4, 0, 0]);
    expect(score).toBe(8);
  });

  it("triple merges the left pair — [2,2,2,0] → [4,2,0,0]", () => {
    const { line, score } = slideAndMerge([2, 2, 2, 0]);
    expect(line).toEqual([4, 2, 0, 0]);
    expect(score).toBe(4);
  });

  it("mixed values no merge", () => {
    const { line, score } = slideAndMerge([2, 4, 2, 4]);
    expect(line).toEqual([2, 4, 2, 4]);
    expect(score).toBe(0);
  });

  it("large values — 1024+1024 = 2048", () => {
    const { line, score } = slideAndMerge([1024, 1024, 0, 0]);
    expect(line).toEqual([2048, 0, 0, 0]);
    expect(score).toBe(2048);
  });

  it("all zeros", () => {
    const { line, score } = slideAndMerge([0, 0, 0, 0]);
    expect(line).toEqual([0, 0, 0, 0]);
    expect(score).toBe(0);
  });

  it("slide-only compact", () => {
    const { line, score } = slideAndMerge([0, 0, 0, 4]);
    expect(line).toEqual([4, 0, 0, 0]);
    expect(score).toBe(0);
  });

  it("merges only first pair — [4,4,8,0] → [8,8,0,0]", () => {
    const { line, score } = slideAndMerge([4, 4, 8, 0]);
    expect(line).toEqual([8, 8, 0, 0]);
    expect(score).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// newGame
// ---------------------------------------------------------------------------

describe("newGame", () => {
  it("spawns exactly two initial tiles", () => {
    const s = newGame();
    const nonZero = s.board.flat().filter((c) => c !== 0).length;
    expect(nonZero).toBe(2);
  });

  it("initial tiles are 2 or 4", () => {
    const s = newGame();
    for (const row of s.board) {
      for (const cell of row) {
        if (cell !== 0) expect([2, 4]).toContain(cell);
      }
    }
  });

  it("initial score is zero", () => {
    expect(newGame().score).toBe(0);
  });

  it("initial not game-over", () => {
    expect(newGame().game_over).toBe(false);
  });

  it("initial not won", () => {
    expect(newGame().has_won).toBe(false);
  });

  it("board is 4x4", () => {
    const s = newGame();
    expect(s.board).toHaveLength(SIZE);
    for (const row of s.board) expect(row).toHaveLength(SIZE);
  });
});

// ---------------------------------------------------------------------------
// move — controlled boards
// ---------------------------------------------------------------------------

describe("move", () => {
  it("left merges same-row tiles", () => {
    const s = stateWith([
      [0, 0, 0, 0],
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(s, "left");
    expect(next.board[1][0]).toBe(4);
    expect(next.score).toBe(4);
  });

  it("right merges same-row tiles to the right edge", () => {
    const s = stateWith([
      [0, 0, 0, 0],
      [0, 2, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(s, "right");
    expect(next.board[1][3]).toBe(4);
    expect(next.score).toBe(4);
  });

  it("up merges same-column tiles toward row 0", () => {
    const s = stateWith([
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(s, "up");
    expect(next.board[0][1]).toBe(4);
    expect(next.score).toBe(4);
  });

  it("down merges same-column tiles toward row 3", () => {
    const s = stateWith([
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 2, 0, 0],
    ]);
    const next = move(s, "down");
    expect(next.board[3][1]).toBe(4);
    expect(next.score).toBe(4);
  });

  it("throws when move has no effect", () => {
    const s = stateWith([
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
    ]);
    expect(() => move(s, "left")).toThrow(/no effect/);
  });

  it("throws on invalid direction", () => {
    const s = newGame();
    expect(() => move(s, "diagonal" as unknown as Direction)).toThrow(/Invalid direction/);
  });

  it("spawns a new tile after a successful move", () => {
    const s = stateWith([
      [0, 0, 0, 0],
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(s, "left");
    // 2+2 merges to 4, spawn adds one more → 2 non-zero
    const nonZero = next.board.flat().filter((c) => c !== 0).length;
    expect(nonZero).toBe(2);
  });

  it("accumulates score across multiple merges in one move", () => {
    const s = stateWith([
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(s, "left");
    // 2+2=4, 4+4=8 → gained 12
    expect(next.score).toBe(12);
  });

  it("throws when called on a game-over state", () => {
    const s = stateWith(
      [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      { game_over: true }
    );
    expect(() => move(s, "left")).toThrow(/Game is over/);
  });

  it("returns a new state object (does not mutate input)", () => {
    const s = stateWith([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const snapshot = JSON.stringify(s);
    move(s, "left");
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// isGameOver
// ---------------------------------------------------------------------------

describe("isGameOver", () => {
  it("not over when an empty cell exists", () => {
    expect(
      isGameOver([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 0],
      ])
    ).toBe(false);
  });

  it("not over when adjacent matches exist", () => {
    expect(
      isGameOver([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 4], // last two match
      ])
    ).toBe(false);
  });

  it("over when full and no matches", () => {
    expect(
      isGameOver([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ])
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// has_won
// ---------------------------------------------------------------------------

describe("has_won", () => {
  it("sets has_won when 2048 is produced", () => {
    const s = stateWith([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(s, "left");
    expect(next.has_won).toBe(true);
    expect(next.board[0][0]).toBe(2048);
  });

  it("has_won stays true after more moves (keep playing)", () => {
    const s = stateWith([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const afterWin = move(s, "left");
    expect(afterWin.has_won).toBe(true);
    expect(afterWin.game_over).toBe(false);
    // Should be able to keep playing
    const afterDown = move(afterWin, "down");
    expect(afterDown.has_won).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Spawn probability (~90% twos)
// ---------------------------------------------------------------------------

describe("spawn probability", () => {
  it("spawns a 2 roughly 90% of the time", () => {
    const counts: Record<number, number> = { 2: 0, 4: 0 };
    for (let i = 0; i < 1000; i++) {
      const s = newGame();
      // count both spawned tiles
      for (const row of s.board) {
        for (const cell of row) {
          if (cell !== 0) counts[cell] = (counts[cell] ?? 0) + 1;
        }
      }
    }
    const ratio2 = counts[2] / (counts[2] + counts[4]);
    expect(ratio2).toBeGreaterThanOrEqual(0.85);
    expect(ratio2).toBeLessThanOrEqual(0.95);
  });
});

// ---------------------------------------------------------------------------
// Seedable RNG
// ---------------------------------------------------------------------------

describe("seedable RNG (setRng + createSeededRng)", () => {
  afterEach(() => {
    // Restore default RNG so subsequent tests aren't affected.
    setRng(Math.random);
  });

  it("same seed produces identical initial boards", () => {
    setRng(createSeededRng(42));
    const a = newGame();
    setRng(createSeededRng(42));
    const b = newGame();
    expect(a.board).toEqual(b.board);
  });

  it("different seeds usually produce different boards", () => {
    setRng(createSeededRng(1));
    const a = newGame();
    setRng(createSeededRng(999));
    const b = newGame();
    // Two different seeds should diverge on at least one cell.
    const flatA = a.board.flat();
    const flatB = b.board.flat();
    const anyDiff = flatA.some((v, i) => v !== flatB[i]);
    expect(anyDiff).toBe(true);
  });

  it("same seed replays the exact tile sequence over 10 moves", () => {
    // Run A
    setRng(createSeededRng(7));
    let a = newGame();
    const sequenceA: number[][][] = [a.board.map((r) => [...r])];
    const directions: Direction[] = ["left", "down", "right", "up", "left"];
    for (const d of directions) {
      try {
        a = move(a, d);
        sequenceA.push(a.board.map((r) => [...r]));
      } catch {
        // "no effect" — try the next direction
      }
    }

    // Run B with same seed
    setRng(createSeededRng(7));
    let b = newGame();
    const sequenceB: number[][][] = [b.board.map((r) => [...r])];
    for (const d of directions) {
      try {
        b = move(b, d);
        sequenceB.push(b.board.map((r) => [...r]));
      } catch {
        // same skip
      }
    }

    expect(sequenceA).toEqual(sequenceB);
  });

  it("rng returning 0.5 spawns a 2 (not 4) — probability gate at 0.9", () => {
    // 0.5 < 0.9 → spawns 2. First call picks the cell index (floor(0.5 * N)),
    // second call decides 2 vs 4.
    setRng(() => 0.5);
    const s = newGame();
    const nonZero = s.board.flat().filter((v) => v !== 0);
    // newGame spawns 2 tiles; both should be 2s.
    expect(nonZero).toEqual([2, 2]);
  });

  it("rng returning 0.95 spawns a 4 — probability gate at 0.9", () => {
    setRng(() => 0.95);
    const s = newGame();
    const nonZero = s.board.flat().filter((v) => v !== 0);
    // 0.95 >= 0.9 → spawns 4s.
    expect(nonZero).toEqual([4, 4]);
  });

  it("setRng(Math.random) after afterEach restores non-determinism", () => {
    // Sanity: back on default, two games should almost always differ.
    const a = newGame();
    const b = newGame();
    // Not guaranteed to differ, but across 16 cells with random placement
    // the odds of a full match are vanishingly small.
    const flatA = a.board.flat();
    const flatB = b.board.flat();
    const anyDiff = flatA.some((v, i) => v !== flatB[i]);
    expect(anyDiff).toBe(true);
  });
});
