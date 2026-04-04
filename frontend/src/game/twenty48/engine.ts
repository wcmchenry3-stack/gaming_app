/**
 * Client-side 2048 engine.
 *
 * Ported from backend/twenty48/game.py. Pure functions returning new state
 * on each move — immutable for React-friendly state updates.
 *
 * After this port, Twenty48Screen runs the engine locally and never makes
 * a per-move API call. This eliminates the rate-limit pressure from
 * fast-paced gameplay (see #158 for rate-limit context).
 */

import { Twenty48State } from "./types";

export const SIZE = 4;

export type Direction = "up" | "down" | "left" | "right";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Slide a single row/column toward index 0 and merge equal neighbours.
 * Each tile may only participate in one merge per move.
 */
export function slideAndMerge(line: readonly number[]): { line: number[]; score: number } {
  const compacted = line.filter((v) => v !== 0);
  const merged: number[] = [];
  let score = 0;
  let i = 0;
  while (i < compacted.length) {
    if (i + 1 < compacted.length && compacted[i] === compacted[i + 1]) {
      const val = compacted[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(compacted[i]);
      i += 1;
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { line: merged, score };
}

function transpose(board: readonly number[][]): number[][] {
  return Array.from({ length: SIZE }, (_, c) =>
    Array.from({ length: SIZE }, (_, r) => board[r][c])
  );
}

function cloneBoard(board: readonly number[][]): number[][] {
  return board.map((row) => [...row]);
}

function boardsEqual(a: readonly number[][], b: readonly number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function spawnTile(board: number[][]): void {
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

/**
 * A board is game-over when it is full AND no two adjacent cells are equal.
 */
export function isGameOver(board: readonly number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return false;
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return false;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return false;
    }
  }
  return true;
}

function boardHas2048(board: readonly number[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell === 2048) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Direction kernels — mutate a working board, return gained score
// ---------------------------------------------------------------------------

function applyLeft(board: number[][]): number {
  let gained = 0;
  for (let r = 0; r < SIZE; r++) {
    const { line, score } = slideAndMerge(board[r]);
    board[r] = line;
    gained += score;
  }
  return gained;
}

function applyRight(board: number[][]): number {
  let gained = 0;
  for (let r = 0; r < SIZE; r++) {
    const reversed = [...board[r]].reverse();
    const { line, score } = slideAndMerge(reversed);
    board[r] = line.reverse();
    gained += score;
  }
  return gained;
}

function applyUp(board: number[][]): { board: number[][]; gained: number } {
  let working = transpose(board);
  const gained = applyLeft(working);
  working = transpose(working);
  return { board: working, gained };
}

function applyDown(board: number[][]): { board: number[][]; gained: number } {
  let working = transpose(board);
  const gained = applyRight(working);
  working = transpose(working);
  return { board: working, gained };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function newGame(): Twenty48State {
  const board: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  spawnTile(board);
  spawnTile(board);
  return { board, score: 0, game_over: false, has_won: false };
}

/**
 * Apply a move to `state`. Returns a new state.
 * Throws if the move has no effect or the game is already over.
 */
export function move(state: Twenty48State, direction: Direction): Twenty48State {
  if (state.game_over) {
    throw new Error("Game is over. Start a new game.");
  }
  if (direction !== "up" && direction !== "down" && direction !== "left" && direction !== "right") {
    throw new Error(`Invalid direction: ${direction}`);
  }

  const oldBoard = state.board;
  let nextBoard = cloneBoard(state.board);
  let gained = 0;

  if (direction === "left") {
    gained = applyLeft(nextBoard);
  } else if (direction === "right") {
    gained = applyRight(nextBoard);
  } else if (direction === "up") {
    const r = applyUp(nextBoard);
    nextBoard = r.board;
    gained = r.gained;
  } else {
    const r = applyDown(nextBoard);
    nextBoard = r.board;
    gained = r.gained;
  }

  if (boardsEqual(nextBoard, oldBoard)) {
    throw new Error("Move has no effect.");
  }

  spawnTile(nextBoard);

  const has_won = state.has_won || boardHas2048(nextBoard);
  const game_over = isGameOver(nextBoard);

  return {
    board: nextBoard,
    score: state.score + gained,
    game_over,
    has_won,
  };
}
