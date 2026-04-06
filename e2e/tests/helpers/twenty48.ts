/**
 * Shared helpers for 2048 e2e tests.
 */

import { Page } from "@playwright/test";

interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
  prevRow: number;
  prevCol: number;
  isNew: boolean;
  isMerge: boolean;
}

export interface InjectedTwenty48State {
  board: number[][];
  tiles: TileData[];
  score: number;
  scoreDelta: number;
  game_over: boolean;
  has_won: boolean;
}

/** Synthesise a tiles[] array from a board, assigning sequential IDs. */
export function tilesFromBoard(board: number[][]): TileData[] {
  const tiles: TileData[] = [];
  let id = 1;
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] !== 0) {
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
      }
    }
  }
  return tiles;
}

/** Build a full v2-compatible state from a partial board-focused spec. */
function makeState(
  partial: Omit<InjectedTwenty48State, "tiles" | "scoreDelta"> &
    Partial<Pick<InjectedTwenty48State, "tiles" | "scoreDelta">>,
): InjectedTwenty48State {
  return {
    scoreDelta: 0,
    tiles: tilesFromBoard(partial.board),
    ...partial,
  };
}

/** Navigate from Home to 2048, clearing any saved state first. */
export async function gotoTwenty48(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("twenty48_game_v2"));
  await page.goto("/");
  await page.getByRole("button", { name: "Play 2048" }).click();
  await page.getByLabel("Game board").waitFor();
}

/** Inject a pre-built state into localStorage then reload home. */
export async function injectGameState(
  page: Page,
  state: InjectedTwenty48State,
): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    (s) => localStorage.setItem("twenty48_game_v2", JSON.stringify(s)),
    state,
  );
  await page.goto("/");
}

/** Set the 2048 RNG seed via the dev/test hook. */
export async function setSeed(page: Page, seed: number): Promise<void> {
  await page.evaluate(
    (s) =>
      (
        window as { __twenty48_setSeed?: (n: number) => void }
      ).__twenty48_setSeed?.(s),
    seed,
  );
}

/**
 * Mid-game state: a few low tiles, score 4, plenty of empty cells.
 * Useful for persistence tests and general "active game" scenarios.
 */
export function midGameState(
  overrides: Partial<Omit<InjectedTwenty48State, "tiles">> = {},
): InjectedTwenty48State {
  const board = overrides.board ?? [
    [0, 0, 0, 0],
    [0, 4, 0, 0],
    [0, 0, 2, 0],
    [0, 0, 0, 0],
  ];
  return makeState({
    board,
    score: 0,
    game_over: false,
    has_won: false,
    ...overrides,
  });
}

/**
 * Near-win state: two 1024 tiles in row 0 — one ArrowLeft merge creates 2048.
 * The rest of the board is full with no adjacent matches so no other merges occur.
 */
export function nearWinState(
  overrides: Partial<Omit<InjectedTwenty48State, "tiles">> = {},
): InjectedTwenty48State {
  const board = overrides.board ?? [
    [1024, 1024, 0, 0],
    [2, 4, 8, 16],
    [4, 8, 16, 32],
    [8, 16, 32, 64],
  ];
  return makeState({
    board,
    score: 5000,
    game_over: false,
    has_won: false,
    ...overrides,
  });
}

/**
 * Already-won state: 2048 tile present, has_won=true.
 */
export function wonState(
  overrides: Partial<Omit<InjectedTwenty48State, "tiles">> = {},
): InjectedTwenty48State {
  const board = overrides.board ?? [
    [2048, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  return makeState({
    board,
    score: 9000,
    game_over: false,
    has_won: true,
    ...overrides,
  });
}

/**
 * Game-over state: board is full, no adjacent equal tiles, game_over=true.
 * Alternating 2/4 pattern — no merges possible in any direction.
 */
export function gameOverState(
  overrides: Partial<Omit<InjectedTwenty48State, "tiles">> = {},
): InjectedTwenty48State {
  const board = overrides.board ?? [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  return makeState({
    board,
    score: 1000,
    game_over: true,
    has_won: false,
    ...overrides,
  });
}

/**
 * Single-merge test state: row 0 is [2,2,2,2], rest is full with no adjacent
 * matches. After ArrowLeft, row 0 becomes [4,4,0,0] — verifies no double-merge.
 */
export function singleMergeState(): InjectedTwenty48State {
  const board: number[][] = [
    [2, 2, 2, 2],
    [4, 8, 16, 32],
    [8, 16, 32, 64],
    [16, 32, 64, 128],
  ];
  return makeState({
    board,
    score: 0,
    game_over: false,
    has_won: false,
  });
}
