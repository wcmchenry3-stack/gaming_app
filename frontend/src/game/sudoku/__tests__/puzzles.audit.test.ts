/**
 * Sudoku puzzle bank solvability audit (#623).
 *
 * Walks every puzzle in `puzzles.json` through the engine's
 * `solvePuzzle` backtracker and asserts that a solution is returned.
 * Paired with the Python uniqueness audit
 * (`backend/tests/test_sudoku_puzzles.py`), this gates the claim that
 * every shipped puzzle has exactly one valid completion.
 *
 * Runtime: ~5 s locally for 3 000 puzzles.  The test is deliberately
 * unconditional — if a future generator run ever produces a
 * non-solvable puzzle, CI fails before the bank is shipped.
 */

import puzzleBank from "../puzzles.json";
import { solvePuzzle } from "../engine";
import type { Difficulty } from "../types";

type Bank = Record<Difficulty, readonly string[]>;

const BANK = puzzleBank as unknown as Bank;
const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

jest.setTimeout(120_000);

describe("puzzles.json — solvability audit", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`all ${difficulty} puzzles solve cleanly`, () => {
      const pool = BANK[difficulty];
      expect(pool.length).toBeGreaterThan(0);
      const failures: Array<{ index: number; puzzle: string }> = [];
      for (let i = 0; i < pool.length; i++) {
        const puzzle = pool[i]!;
        const solution = solvePuzzle(puzzle);
        if (solution === null || solution.length !== 81) {
          failures.push({ index: i, puzzle });
          if (failures.length >= 5) break; // enough to diagnose
        }
      }
      if (failures.length > 0) {
        const summary = failures.map((f) => `  ${difficulty}[${f.index}] = ${f.puzzle}`).join("\n");
        throw new Error(`${failures.length} ${difficulty} puzzle(s) failed to solve:\n${summary}`);
      }
    });
  }

  it("has 3 000 puzzles total — 1 000 per difficulty", () => {
    expect(BANK.easy.length).toBe(1000);
    expect(BANK.medium.length).toBe(1000);
    expect(BANK.hard.length).toBe(1000);
  });
});
