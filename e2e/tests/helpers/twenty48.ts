/**
 * Shared helpers for 2048 e2e tests.
 */

import { Page } from "@playwright/test";

export interface InjectedTwenty48State {
  board: number[][];
  score: number;
  game_over: boolean;
  has_won: boolean;
}

/** Navigate from Home to 2048, clearing any saved state first. */
export async function gotoTwenty48(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("twenty48_game_v1"));
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
    (s) => localStorage.setItem("twenty48_game_v1", JSON.stringify(s)),
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
  overrides: Partial<InjectedTwenty48State> = {},
): InjectedTwenty48State {
  return {
    board: [
      [0, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 2, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    game_over: false,
    has_won: false,
    ...overrides,
  };
}

/**
 * Near-win state: two 1024 tiles in row 0 — one ArrowLeft merge creates 2048.
 * The rest of the board is full with no adjacent matches so no other merges occur.
 */
export function nearWinState(
  overrides: Partial<InjectedTwenty48State> = {},
): InjectedTwenty48State {
  return {
    board: [
      [1024, 1024, 0, 0],
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
    ],
    score: 5000,
    game_over: false,
    has_won: false,
    ...overrides,
  };
}

/**
 * Already-won state: 2048 tile present, has_won=true.
 * Win overlay should NOT show (caller sets winDismissed via keep-playing flow).
 */
export function wonState(
  overrides: Partial<InjectedTwenty48State> = {},
): InjectedTwenty48State {
  return {
    board: [
      [2048, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ],
    score: 9000,
    game_over: false,
    has_won: true,
    ...overrides,
  };
}

/**
 * Game-over state: board is full, no adjacent equal tiles, game_over=true.
 * Alternating 2/4 pattern — no merges possible in any direction.
 */
export function gameOverState(
  overrides: Partial<InjectedTwenty48State> = {},
): InjectedTwenty48State {
  return {
    board: [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ],
    score: 1000,
    game_over: true,
    has_won: false,
    ...overrides,
  };
}

/**
 * Single-merge test state: row 0 is [2,2,2,2], rest is full with no adjacent
 * matches. After ArrowLeft, row 0 becomes [4,4,0,0] — verifies no double-merge.
 */
export function singleMergeState(): InjectedTwenty48State {
  return {
    board: [
      [2, 2, 2, 2],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ],
    score: 0,
    game_over: false,
    has_won: false,
  };
}
