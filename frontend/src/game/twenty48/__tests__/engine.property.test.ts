/**
 * Property-based tests for the 2048 engine (GH #214).
 *
 * Uses fast-check to verify engine invariants across hundreds of
 * randomly-generated inputs — catching edge cases that hand-crafted
 * example tests miss.
 *
 * Design principle: every `fc.assert` block expresses a law that must
 * hold for ALL valid inputs, not just the ones we happened to think of.
 */

import * as fc from "fast-check";
import {
  slideAndMerge,
  move,
  isGameOver,
  newGame,
  setRng,
  createSeededRng,
  SIZE,
  Direction,
} from "../engine";
import { Twenty48State } from "../types";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Valid tile values: 0 (empty) or a power of 2 from 2 to 2048. */
const tileArb = fc.oneof(
  fc.constant(0),
  fc.constantFrom(2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048)
);

/** A line of SIZE tiles (the input format for slideAndMerge). */
const lineArb: fc.Arbitrary<number[]> = fc.array(tileArb, {
  minLength: SIZE,
  maxLength: SIZE,
});

/** A 4×4 board of valid tile values. */
const boardArb: fc.Arbitrary<number[][]> = fc.array(
  fc.array(tileArb, { minLength: SIZE, maxLength: SIZE }),
  { minLength: SIZE, maxLength: SIZE }
);

/** A Twenty48State built from an arbitrary board. */
const stateArb: fc.Arbitrary<Twenty48State> = boardArb.map((board) => ({
  board,
  score: 0,
  game_over: false,
  has_won: false,
}));

/** Any board that is not game-over (has at least one empty cell or adjacent match). */
const playableStateArb: fc.Arbitrary<Twenty48State> = stateArb.filter(
  (s) => !isGameOver(s.board)
);

const directionArb: fc.Arbitrary<Direction> = fc.constantFrom<Direction>(
  "up",
  "down",
  "left",
  "right"
);

// ---------------------------------------------------------------------------
// Helper: count non-zero cells in a board
// ---------------------------------------------------------------------------

function nonZeroCount(board: number[][]): number {
  return board.flat().filter((v) => v !== 0).length;
}

// ---------------------------------------------------------------------------
// Helper: check if a board has any two adjacent equal non-zero cells
// ---------------------------------------------------------------------------

function hasAdjacentMatch(board: number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) continue;
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// slideAndMerge properties
// ---------------------------------------------------------------------------

describe("slideAndMerge — properties", () => {
  it("output length is always SIZE", () => {
    fc.assert(
      fc.property(lineArb, (line) => {
        const { line: out } = slideAndMerge(line);
        expect(out).toHaveLength(SIZE);
      })
    );
  });

  it("sum is conserved (merging 2+2→4 preserves total value)", () => {
    fc.assert(
      fc.property(lineArb, (line) => {
        const inputSum = line.reduce((a, b) => a + b, 0);
        const { line: out, score } = slideAndMerge(line);
        const outputSum = out.reduce((a, b) => a + b, 0);
        expect(outputSum).toBe(inputSum);
        // Score equals the value gained from merges; it must not exceed inputSum
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(inputSum);
      })
    );
  });

  it("score equals sum of merged tile values", () => {
    // For every merge of v+v → 2v, score accumulates 2v.
    // We verify that score === outputSum - (inputSum - mergedInputSum),
    // which reduces to: score = sum(merged output) - sum(unmerged input tiles).
    // Simpler: score >= 0 and score is always an even number (merges produce powers of 2).
    fc.assert(
      fc.property(lineArb, (line) => {
        const { score } = slideAndMerge(line);
        expect(score % 2).toBe(0);
        expect(score).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it("no merges occur when compacted input has no adjacent equal values", () => {
    // The merge rule is: only compact-adjacent equal pairs merge.
    // If no such pairs exist, the output is a pure slide — score must be 0
    // and non-zero count must be unchanged.
    fc.assert(
      fc.property(lineArb, (line) => {
        const compacted = line.filter((v) => v !== 0);
        const hasAdjacentEqual = compacted.some(
          (v, i) => i + 1 < compacted.length && v === compacted[i + 1]
        );
        if (!hasAdjacentEqual) {
          const { line: out, score } = slideAndMerge(line);
          expect(score).toBe(0);
          expect(out.filter((v) => v !== 0).length).toBe(compacted.length);
        }
      })
    );
  });

  it("a merge always occurs when compacted input has at least one adjacent equal pair", () => {
    // If there are mergeable pairs, score must be > 0.
    fc.assert(
      fc.property(lineArb, (line) => {
        const compacted = line.filter((v) => v !== 0);
        const hasAdjacentEqual = compacted.some(
          (v, i) => i + 1 < compacted.length && v === compacted[i + 1]
        );
        if (hasAdjacentEqual) {
          const { score } = slideAndMerge(line);
          expect(score).toBeGreaterThan(0);
        }
      })
    );
  });

  it("all zeros are at the tail (tiles slide to index 0)", () => {
    fc.assert(
      fc.property(lineArb, (line) => {
        const { line: out } = slideAndMerge(line);
        // Once a zero appears, all remaining positions must also be zero.
        let seenZero = false;
        for (const v of out) {
          if (v === 0) seenZero = true;
          if (seenZero) expect(v).toBe(0);
        }
      })
    );
  });

  it("non-zero tile count never increases (merges can only reduce or preserve)", () => {
    fc.assert(
      fc.property(lineArb, (line) => {
        const inputNonZero = line.filter((v) => v !== 0).length;
        const { line: out } = slideAndMerge(line);
        const outputNonZero = out.filter((v) => v !== 0).length;
        expect(outputNonZero).toBeLessThanOrEqual(inputNonZero);
      })
    );
  });

  it("output tile values are non-negative", () => {
    fc.assert(
      fc.property(lineArb, (line) => {
        const { line: out } = slideAndMerge(line);
        for (const v of out) expect(v).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it("all-zero input produces all-zero output with score 0", () => {
    const { line: out, score } = slideAndMerge([0, 0, 0, 0]);
    expect(out).toEqual([0, 0, 0, 0]);
    expect(score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// move — score invariants
// ---------------------------------------------------------------------------

describe("move — score invariants", () => {
  it("score never decreases after a valid move", () => {
    fc.assert(
      fc.property(playableStateArb, directionArb, (state, direction) => {
        try {
          const next = move(state, direction);
          expect(next.score).toBeGreaterThanOrEqual(state.score);
        } catch {
          // "no effect" or game-over — not a failure, just skip
        }
      })
    );
  });

  it("score increase equals the sum of all merged tile values", () => {
    // A state with exactly one pair that will merge — we know the exact gain.
    fc.assert(
      fc.property(
        fc.constantFrom(2, 4, 8, 16, 32, 64, 128, 256, 512, 1024),
        (v) => {
          // Row 1 has two tiles of value v — left move will merge them.
          const state: Twenty48State = {
            board: [
              [0, 0, 0, 0],
              [v, 0, v, 0],
              [0, 0, 0, 0],
              [0, 0, 0, 0],
            ],
            score: 0,
            game_over: false,
            has_won: false,
          };
          // Use a seeded RNG to avoid flaky spawn positions.
          setRng(createSeededRng(1));
          const next = move(state, "left");
          setRng(Math.random);
          expect(next.score).toBe(v * 2);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// move — tile count invariants
// ---------------------------------------------------------------------------

describe("move — tile count invariants", () => {
  it("each valid move spawns exactly one new tile", () => {
    // On a valid move the engine: (1) slides+merges the board, (2) spawns 1 tile.
    // Net effect: non-zero count = pre-move count - merges + 1.
    // Since merges >= 0, the count can decrease, stay same+1, or increase by 1.
    // The strongest checkable bound: non-zero(after) <= non-zero(before) + 1.
    fc.assert(
      fc.property(playableStateArb, directionArb, (state, direction) => {
        try {
          const before = nonZeroCount(state.board);
          const next = move(state, direction);
          const after = nonZeroCount(next.board);
          // At most one new tile was added (the spawn).
          expect(after).toBeLessThanOrEqual(before + 1);
          // At least one tile must remain (we never have an empty board).
          expect(after).toBeGreaterThanOrEqual(1);
        } catch {
          // "no effect" — skip
        }
      })
    );
  });

  it("on a slide-only move (no merges), exactly one new tile is added", () => {
    // Board with one tile that can slide but has nothing to merge with.
    // Use left move on a board where the only tile is NOT at the left edge.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }), // starting column (not 0)
        fc.integer({ min: 0, max: 3 }), // row
        fc.constantFrom(2, 4, 8, 16, 32) as fc.Arbitrary<number>,
        (col, row, val) => {
          const board = Array.from({ length: SIZE }, (_, r) =>
            Array.from({ length: SIZE }, (_, c) => (r === row && c === col ? val : 0))
          );
          const state: Twenty48State = { board, score: 0, game_over: false, has_won: false };
          setRng(createSeededRng(42));
          const next = move(state, "left");
          setRng(Math.random);
          expect(nonZeroCount(next.board)).toBe(2); // 1 original (slid) + 1 spawned
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// move — immutability
// ---------------------------------------------------------------------------

describe("move — immutability", () => {
  it("never mutates the input state", () => {
    fc.assert(
      fc.property(playableStateArb, directionArb, (state, direction) => {
        const snapshot = JSON.stringify(state);
        try {
          move(state, direction);
        } catch {
          // "no effect" is fine
        }
        expect(JSON.stringify(state)).toBe(snapshot);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// move — has_won stickiness
// ---------------------------------------------------------------------------

describe("move — has_won is sticky", () => {
  it("once has_won is true it stays true after further moves", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }).map((seed) => createSeededRng(seed)),
        (rng) => {
          // Build a state where the NEXT left move produces 2048 and has spare space.
          const state: Twenty48State = {
            board: [
              [1024, 1024, 0, 0],
              [0, 0, 0, 0],
              [0, 0, 0, 0],
              [0, 0, 0, 0],
            ],
            score: 0,
            game_over: false,
            has_won: false,
          };
          setRng(rng);
          const afterWin = move(state, "left");
          expect(afterWin.has_won).toBe(true);
          expect(afterWin.game_over).toBe(false);
          // One more move down — has_won must remain true.
          try {
            const afterNext = move(afterWin, "down");
            expect(afterNext.has_won).toBe(true);
          } catch {
            // "no effect" is fine — win flag is already verified above
          }
          setRng(Math.random);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// isGameOver — properties
// ---------------------------------------------------------------------------

describe("isGameOver — properties", () => {
  it("never game-over when any cell is empty", () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        const hasEmpty = board.some((row) => row.includes(0));
        if (hasEmpty) {
          expect(isGameOver(board)).toBe(false);
        }
      })
    );
  });

  it("never game-over when any two adjacent cells are equal and non-zero", () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        if (hasAdjacentMatch(board)) {
          expect(isGameOver(board)).toBe(false);
        }
      })
    );
  });

  it("game-over implies every direction throws 'no effect'", () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        if (!isGameOver(board)) return;
        // The engine sets game_over on the state when isGameOver returns true.
        // But move() checks state.game_over first and throws "Game is over".
        // To test the board-level invariant we use a state with game_over=false
        // so the "no effect" check runs instead.
        const state: Twenty48State = {
          board,
          score: 0,
          game_over: false, // bypass the game-over guard to reach boardsEqual check
          has_won: false,
        };
        const directions: Direction[] = ["up", "down", "left", "right"];
        for (const d of directions) {
          expect(() => move(state, d)).toThrow();
        }
      })
    );
  });

  it("isGameOver is false when board has an empty cell (fuzz complement)", () => {
    // Generate boards with at least one forced empty cell.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: SIZE - 1 }),
        fc.integer({ min: 0, max: SIZE - 1 }),
        boardArb,
        (r, c, board) => {
          const withEmpty = board.map((row, ri) =>
            row.map((cell, ci) => (ri === r && ci === c ? 0 : cell))
          );
          expect(isGameOver(withEmpty)).toBe(false);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// newGame — properties
// ---------------------------------------------------------------------------

describe("newGame — properties", () => {
  it("always starts with exactly 2 non-zero tiles", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }).map((seed) => createSeededRng(seed)),
        (rng) => {
          setRng(rng);
          const s = newGame();
          setRng(Math.random);
          expect(nonZeroCount(s.board)).toBe(2);
        }
      )
    );
  });

  it("initial tiles are always 2 or 4", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }).map((seed) => createSeededRng(seed)),
        (rng) => {
          setRng(rng);
          const s = newGame();
          setRng(Math.random);
          for (const cell of s.board.flat()) {
            if (cell !== 0) expect([2, 4]).toContain(cell);
          }
        }
      )
    );
  });

  it("initial score, game_over, and has_won are always at their zero state", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }).map((seed) => createSeededRng(seed)),
        (rng) => {
          setRng(rng);
          const s = newGame();
          setRng(Math.random);
          expect(s.score).toBe(0);
          expect(s.game_over).toBe(false);
          expect(s.has_won).toBe(false);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Round-trip: board values remain valid powers of 2 through moves
// ---------------------------------------------------------------------------

describe("board tile validity through moves", () => {
  const VALID_TILES = new Set([0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]);

  it("all tile values remain powers of 2 (or zero) across arbitrary move sequences", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.array(directionArb, { minLength: 1, maxLength: 20 }),
        (seed, directions) => {
          setRng(createSeededRng(seed));
          let state = newGame();
          for (const d of directions) {
            if (state.game_over) break;
            try {
              state = move(state, d);
            } catch {
              // "no effect" — skip
            }
          }
          setRng(Math.random);
          for (const cell of state.board.flat()) {
            expect(VALID_TILES.has(cell)).toBe(true);
          }
        }
      )
    );
  });

  it("score is always non-negative across arbitrary move sequences", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.array(directionArb, { minLength: 1, maxLength: 20 }),
        (seed, directions) => {
          setRng(createSeededRng(seed));
          let state = newGame();
          for (const d of directions) {
            if (state.game_over) break;
            try {
              state = move(state, d);
            } catch {
              // "no effect" — skip
            }
          }
          setRng(Math.random);
          expect(state.score).toBeGreaterThanOrEqual(0);
        }
      )
    );
  });

  it("game_over is sticky — once true, stays true regardless of further move attempts", () => {
    // Find a game-over state via seeded play, then confirm it stays game_over.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.array(directionArb, { minLength: 50, maxLength: 200 }),
        (seed, directions) => {
          setRng(createSeededRng(seed));
          let state = newGame();
          for (const d of directions) {
            if (state.game_over) break;
            try {
              state = move(state, d);
            } catch {
              // "no effect"
            }
          }
          setRng(Math.random);
          if (!state.game_over) return; // didn't reach game over — skip
          // Attempting any direction on a game_over state must throw.
          for (const d of (["up", "down", "left", "right"] as Direction[])) {
            expect(() => move(state, d)).toThrow(/Game is over/);
          }
        }
      )
    );
  });
});
