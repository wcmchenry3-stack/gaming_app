/**
 * AsyncStorage persistence for in-progress Sudoku games (#619).
 *
 * Saves after every state mutation so a crash or backgrounded app
 * doesn't lose progress. One slot per device — no account linkage in
 * V1, matching the Solitaire/Hearts pattern.
 *
 * Pencil notes (`Set<NoteDigit>`) don't round-trip through JSON, so
 * `saveGame` converts each set to a sorted array and `loadGame`
 * restores it. `undoStack` snapshots carry their own `notes` sets —
 * those get the same treatment.
 *
 * `loadGame` enforces `_v: 1` so future schema bumps reject
 * incompatible payloads rather than corrupting state.  Anything
 * unparseable or shape-invalid is discarded and returns null; the
 * caller recovers by starting a fresh puzzle.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { Grid, NoteDigit, SudokuCell, SudokuState } from "./types";

const GAME_KEY = "sudoku_game";

interface SerializedCell {
  value: number;
  given: boolean;
  notes: number[];
  isError: boolean;
}

interface SerializedState {
  _v: 1;
  difficulty: string;
  puzzle: string;
  solution: string;
  grid: SerializedCell[][];
  selectedRow: number | null;
  selectedCol: number | null;
  notesMode: boolean;
  errorCount: number;
  isComplete: boolean;
  undoStack: Array<Omit<SerializedState, "undoStack"> & { undoStack: [] }>;
}

function serializeCell(c: SudokuCell): SerializedCell {
  return {
    value: c.value,
    given: c.given,
    notes: Array.from(c.notes).sort((a, b) => a - b),
    isError: c.isError,
  };
}

function serializeGrid(g: Grid): SerializedCell[][] {
  return g.map((row) => row.map(serializeCell));
}

function serializeSnapshot(s: SudokuState): Omit<SerializedState, "undoStack"> {
  return {
    _v: 1,
    difficulty: s.difficulty,
    puzzle: s.puzzle,
    solution: s.solution,
    grid: serializeGrid(s.grid),
    selectedRow: s.selectedRow,
    selectedCol: s.selectedCol,
    notesMode: s.notesMode,
    errorCount: s.errorCount,
    isComplete: s.isComplete,
  };
}

function serializeState(s: SudokuState): SerializedState {
  return {
    ...serializeSnapshot(s),
    undoStack: s.undoStack.map((snap) => ({
      ...serializeSnapshot(snap),
      undoStack: [] as [],
    })),
  };
}

function restoreCell(c: SerializedCell): SudokuCell {
  return {
    value: c.value as SudokuCell["value"],
    given: c.given,
    notes: new Set(c.notes as NoteDigit[]),
    isError: c.isError,
  };
}

function restoreGrid(rows: SerializedCell[][]): Grid {
  return rows.map((row) => row.map(restoreCell));
}

function restoreSnapshot(p: Omit<SerializedState, "undoStack">): Omit<SudokuState, "undoStack"> {
  return {
    _v: 1,
    difficulty: p.difficulty as SudokuState["difficulty"],
    puzzle: p.puzzle,
    solution: p.solution,
    grid: restoreGrid(p.grid),
    selectedRow: p.selectedRow,
    selectedCol: p.selectedCol,
    notesMode: p.notesMode,
    errorCount: p.errorCount,
    isComplete: p.isComplete,
  };
}

/** Minimal structural validation — enough to catch truncated payloads
 * and version bumps without pulling in a schema library. */
function looksValid(p: unknown): p is SerializedState {
  if (p === null || typeof p !== "object") return false;
  const o = p as Partial<SerializedState>;
  if (o._v !== 1) return false;
  if (o.difficulty !== "easy" && o.difficulty !== "medium" && o.difficulty !== "hard") {
    return false;
  }
  if (typeof o.puzzle !== "string" || o.puzzle.length !== 81) return false;
  if (typeof o.solution !== "string" || o.solution.length !== 81) return false;
  if (!Array.isArray(o.grid) || o.grid.length !== 9) return false;
  for (const row of o.grid) {
    if (!Array.isArray(row) || row.length !== 9) return false;
    for (const cell of row) {
      if (cell === null || typeof cell !== "object") return false;
      if (typeof (cell as SerializedCell).value !== "number") return false;
      if (typeof (cell as SerializedCell).given !== "boolean") return false;
      if (!Array.isArray((cell as SerializedCell).notes)) return false;
      if (typeof (cell as SerializedCell).isError !== "boolean") return false;
    }
  }
  if (typeof o.notesMode !== "boolean") return false;
  if (typeof o.errorCount !== "number") return false;
  if (typeof o.isComplete !== "boolean") return false;
  if (!Array.isArray(o.undoStack)) return false;
  return true;
}

export async function saveGame(state: SudokuState): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(serializeState(state)));
  } catch (e) {
    Sentry.captureException(e, {
      tags: { subsystem: "sudoku.storage", op: "save" },
    });
  }
}

export async function loadGame(): Promise<SudokuState | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(GAME_KEY);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { subsystem: "sudoku.storage", op: "load" },
    });
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    Sentry.captureMessage("sudoku.storage: unparseable payload, discarding", {
      level: "warning",
      tags: { subsystem: "sudoku.storage", op: "load" },
    });
    await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
    return null;
  }

  if (!looksValid(parsed)) {
    Sentry.captureMessage("sudoku.storage: invalid payload shape, discarding", {
      level: "warning",
      tags: { subsystem: "sudoku.storage", op: "load" },
    });
    await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
    return null;
  }

  const snapshot = restoreSnapshot(parsed);
  return {
    ...snapshot,
    undoStack: parsed.undoStack.map((snap) => ({
      ...restoreSnapshot(snap),
      undoStack: [] as const,
    })),
  };
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GAME_KEY);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { subsystem: "sudoku.storage", op: "clear" },
    });
  }
}
