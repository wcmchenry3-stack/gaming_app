/**
 * Client-side 2048 engine.
 *
 * Pure functions returning new state on each move — immutable for
 * React-friendly state updates.
 *
 * Each tile carries a stable numeric ID assigned at spawn. The `tiles`
 * array records per-tile animation metadata (prevRow/prevCol, isNew,
 * isMerge) so the renderer can animate slides, merges, and spawns
 * without tracking state itself.
 */

import { Twenty48State, TileData } from "./types";

export const SIZE = 4;

export type Direction = "up" | "down" | "left" | "right";

// ---------------------------------------------------------------------------
// Tile ID counter
// ---------------------------------------------------------------------------

let _nextTileId = 1;

function nextId(): number {
  return _nextTileId++;
}

/** Reset the ID counter — for testing only. */
export function _resetTileIds(): void {
  _nextTileId = 1;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Slide a single row/column toward index 0 and merge equal neighbours.
 * Each tile may only participate in one merge per move.
 *
 * Operates on parallel value and ID arrays so tile identity is preserved
 * through the slide. Merged tiles receive a new ID; the score delta and
 * the set of newly-merged IDs are returned alongside the output arrays.
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

/** Internal version that also threads tile IDs through the merge logic. */
function slideAndMergeWithIds(
  values: readonly number[],
  ids: readonly number[]
): { values: number[]; ids: number[]; score: number; mergedIds: Set<number> } {
  const cv: number[] = [];
  const ci: number[] = [];
  for (let k = 0; k < values.length; k++) {
    if (values[k] !== 0) {
      cv.push(values[k]);
      ci.push(ids[k]);
    }
  }

  const outV: number[] = [];
  const outI: number[] = [];
  const mergedIds = new Set<number>();
  let score = 0;
  let i = 0;
  while (i < cv.length) {
    if (i + 1 < cv.length && cv[i] === cv[i + 1]) {
      const val = cv[i] * 2;
      const id = nextId();
      outV.push(val);
      outI.push(id);
      mergedIds.add(id);
      score += val;
      i += 2;
    } else {
      outV.push(cv[i]);
      outI.push(ci[i]);
      i++;
    }
  }
  while (outV.length < SIZE) {
    outV.push(0);
    outI.push(0);
  }
  return { values: outV, ids: outI, score, mergedIds };
}

function transpose(board: readonly number[][]): number[][] {
  return Array.from({ length: SIZE }, (_, c) =>
    Array.from({ length: SIZE }, (_, r) => board[r][c])
  );
}

function cloneBoard(board: readonly number[][]): number[][] {
  return board.map((row) => [...row]);
}

function cloneIds(ids: readonly number[][]): number[][] {
  return ids.map((row) => [...row]);
}

function boardsEqual(a: readonly number[][], b: readonly number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Seedable RNG
// ---------------------------------------------------------------------------

export type RandomSource = () => number;

let _rng: RandomSource = Math.random;

export function setRng(fn: RandomSource): void {
  _rng = fn;
}

/**
 * LCG deterministic RNG — for testing only.
 */
export function createSeededRng(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// E2E test hook
const _devHook = typeof __DEV__ !== "undefined" && __DEV__;
const _testHook = process.env.EXPO_PUBLIC_TEST_HOOKS === "1";
if ((_devHook || _testHook) && typeof globalThis !== "undefined") {
  (globalThis as unknown as { __twenty48_setSeed?: (seed: number) => void }).__twenty48_setSeed = (
    seed: number
  ) => {
    setRng(createSeededRng(seed));
  };
}

function spawnTile(board: number[][], idBoard: number[][]): void {
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(_rng() * empty.length)];
  board[r][c] = _rng() < 0.9 ? 2 : 4;
  idBoard[r][c] = nextId();
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
// Build TileData[] from board + idBoard + previous tile positions
// ---------------------------------------------------------------------------

function buildTiles(
  board: number[][],
  idBoard: number[][],
  prevPositions: Map<number, { row: number; col: number }>,
  mergedIds: Set<number>,
  spawnedIds: Set<number>
): TileData[] {
  const tiles: TileData[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const id = idBoard[r][c];
      if (id === 0) continue;
      const prev = prevPositions.get(id);
      tiles.push({
        id,
        value: board[r][c],
        row: r,
        col: c,
        prevRow: prev?.row ?? null,
        prevCol: prev?.col ?? null,
        isNew: spawnedIds.has(id),
        isMerge: mergedIds.has(id),
      });
    }
  }
  return tiles;
}

/** Extract previous tile positions from the current tiles array. */
function positionMap(tiles: readonly TileData[]): Map<number, { row: number; col: number }> {
  const map = new Map<number, { row: number; col: number }>();
  for (const t of tiles) map.set(t.id, { row: t.row, col: t.col });
  return map;
}

/** Derive an ID board from a tiles array. */
function idBoardFromTiles(tiles: readonly TileData[]): number[][] {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const t of tiles) board[t.row][t.col] = t.id;
  return board;
}

// ---------------------------------------------------------------------------
// Direction kernels — mutate working board + idBoard, return gained score
// and accumulated merged IDs
// ---------------------------------------------------------------------------

function applyLeft(
  board: number[][],
  idBoard: number[][]
): { score: number; mergedIds: Set<number> } {
  let score = 0;
  const mergedIds = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    const result = slideAndMergeWithIds(board[r], idBoard[r]);
    board[r] = result.values;
    idBoard[r] = result.ids;
    score += result.score;
    for (const id of result.mergedIds) mergedIds.add(id);
  }
  return { score, mergedIds };
}

function applyRight(
  board: number[][],
  idBoard: number[][]
): { score: number; mergedIds: Set<number> } {
  let score = 0;
  const mergedIds = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    const revV = [...board[r]].reverse();
    const revI = [...idBoard[r]].reverse();
    const result = slideAndMergeWithIds(revV, revI);
    board[r] = result.values.reverse();
    idBoard[r] = result.ids.reverse();
    score += result.score;
    for (const id of result.mergedIds) mergedIds.add(id);
  }
  return { score, mergedIds };
}

function applyUp(
  board: number[][],
  idBoard: number[][]
): { board: number[][]; idBoard: number[][]; score: number; mergedIds: Set<number> } {
  let wb = transpose(board);
  let wi = transpose(idBoard);
  const { score, mergedIds } = applyLeft(wb, wi);
  wb = transpose(wb);
  wi = transpose(wi);
  return { board: wb, idBoard: wi, score, mergedIds };
}

function applyDown(
  board: number[][],
  idBoard: number[][]
): { board: number[][]; idBoard: number[][]; score: number; mergedIds: Set<number> } {
  let wb = transpose(board);
  let wi = transpose(idBoard);
  const { score, mergedIds } = applyRight(wb, wi);
  wb = transpose(wb);
  wi = transpose(wi);
  return { board: wb, idBoard: wi, score, mergedIds };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function newGame(): Twenty48State {
  const board: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  const idBoard: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  spawnTile(board, idBoard);
  spawnTile(board, idBoard);

  // All tiles in a new game are "new" (spawn animation).
  const spawnedIds = new Set<number>();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (idBoard[r][c] !== 0) spawnedIds.add(idBoard[r][c]);

  const tiles = buildTiles(board, idBoard, new Map(), new Set(), spawnedIds);
  return { board, tiles, score: 0, scoreDelta: 0, game_over: false, has_won: false };
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
  let nextIdBoard = cloneIds(idBoardFromTiles(state.tiles));
  let gained = 0;
  let mergedIds = new Set<number>();

  if (direction === "left") {
    const r = applyLeft(nextBoard, nextIdBoard);
    gained = r.score;
    mergedIds = r.mergedIds;
  } else if (direction === "right") {
    const r = applyRight(nextBoard, nextIdBoard);
    gained = r.score;
    mergedIds = r.mergedIds;
  } else if (direction === "up") {
    const r = applyUp(nextBoard, nextIdBoard);
    nextBoard = r.board;
    nextIdBoard = r.idBoard;
    gained = r.score;
    mergedIds = r.mergedIds;
  } else {
    const r = applyDown(nextBoard, nextIdBoard);
    nextBoard = r.board;
    nextIdBoard = r.idBoard;
    gained = r.score;
    mergedIds = r.mergedIds;
  }

  if (boardsEqual(nextBoard, oldBoard)) {
    throw new Error("Move has no effect.");
  }

  const prevPositions = positionMap(state.tiles);

  const spawnedIds = new Set<number>();
  spawnTile(nextBoard, nextIdBoard);
  // Find the newly spawned ID (the one in nextIdBoard not in prevPositions).
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const id = nextIdBoard[r][c];
      if (id !== 0 && !prevPositions.has(id) && !mergedIds.has(id)) {
        spawnedIds.add(id);
      }
    }
  }

  const tiles = buildTiles(nextBoard, nextIdBoard, prevPositions, mergedIds, spawnedIds);
  const has_won = state.has_won || boardHas2048(nextBoard);
  const game_over = isGameOver(nextBoard);

  return {
    board: nextBoard,
    tiles,
    score: state.score + gained,
    scoreDelta: gained,
    game_over,
    has_won,
  };
}
