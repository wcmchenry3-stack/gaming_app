/**
 * Sudoku — shared types (#616).
 *
 * Pure data. No React, no AsyncStorage, no side effects. Imported by the
 * engine, UI components, and persistence layer alike.
 */

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

/** 0 means empty. 1-9 are the placed digits. */
export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 1-9, the only valid pencil-note values. */
export type NoteDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface SudokuCell {
  readonly value: CellValue;
  /** True for cells that were part of the initial puzzle; UI must block input. */
  readonly given: boolean;
  /** Digits the player has pencilled in. Empty when `value !== 0` in practice. */
  readonly notes: ReadonlySet<NoteDigit>;
  /** True when `value !== 0` and `value !== solution[row*9+col]`. */
  readonly isError: boolean;
}

/** 9×9 grid, indexed [row][col]. */
export type Grid = readonly (readonly SudokuCell[])[];

/** Immutable snapshot. `_v` is a schema version so persisted saves can
 * be migrated or rejected safely. */
export interface SudokuState {
  readonly _v: 1;
  readonly difficulty: Difficulty;
  /** Original 81-character string from `puzzles.json`. Kept so the UI
   * can detect givens and reset to initial state without recomputing. */
  readonly puzzle: string;
  /** 81-character solution derived at load time by `solvePuzzle`. */
  readonly solution: string;
  readonly grid: Grid;
  /** Selected cell (row, col) or null. Givens may be selected for
   * highlighting, but `enterDigit` / `eraseCell` are no-ops on them. */
  readonly selectedRow: number | null;
  readonly selectedCol: number | null;
  readonly notesMode: boolean;
  readonly errorCount: number;
  readonly isComplete: boolean;
  /** Prior snapshots for undo. Capped at 50 entries (FIFO eviction).
   * Nested `undoStack` is always `[]` to prevent exponential nesting. */
  readonly undoStack: readonly SudokuState[];
}

export const UNDO_STACK_LIMIT = 50;
