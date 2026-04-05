/**
 * twenty48-full-game.spec.ts — GH #208
 *
 * Happy-path user journey for 2048:
 *   Home → Play 2048 → moves via keyboard → score increments → New Game → Back
 *
 * Tiles expose accessibilityLabel = value (or "empty"), and the score element
 * exposes accessibilityLabel = "Current score: N", so board/score state is
 * directly inspectable without any DOM hacks.
 */

import { test, expect } from "@playwright/test";
import {
  gotoTwenty48,
  injectGameState,
  setSeed,
  midGameState,
  singleMergeState,
} from "./helpers/twenty48";

test.describe("2048 — full happy-path game journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("twenty48_game_v1"));
    await page.goto("/");
  });

  test("navigates from Home to 2048 on Play 2048 click", async ({ page }) => {
    await expect(page.getByText("Gaming App").first()).toBeVisible();
    await page.getByRole("button", { name: "Play 2048" }).click();
    await expect(page.getByLabel("Game board")).toBeVisible();
  });

  test("initial board has exactly 2 non-empty tiles (seeded)", async ({
    page,
  }) => {
    await gotoTwenty48(page);
    // Seed before newGame() spawns tiles
    await setSeed(page, 1);
    await page.getByRole("button", { name: "Start a new 2048 game" }).click();

    const empties = page.getByLabel("empty");
    const emptyCount = await empties.count();
    // 16 total cells − 2 spawned = 14 empty
    expect(emptyCount).toBe(14);
  });

  test("arrow key left fires a move and changes the board", async ({
    page,
  }) => {
    await injectGameState(page, midGameState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    const emptyBefore = await page.getByLabel("empty").count();
    await page.keyboard.press("ArrowLeft");

    // After a valid move a new tile spawns → one fewer empty cell
    await expect(page.getByLabel("empty")).toHaveCount(emptyBefore - 1, {
      timeout: 3000,
    });
  });

  test("arrow key right fires a move", async ({ page }) => {
    await injectGameState(page, midGameState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    const emptyBefore = await page.getByLabel("empty").count();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel("empty")).toHaveCount(emptyBefore - 1, {
      timeout: 3000,
    });
  });

  test("arrow key up fires a move", async ({ page }) => {
    await injectGameState(page, midGameState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    const emptyBefore = await page.getByLabel("empty").count();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByLabel("empty")).toHaveCount(emptyBefore - 1, {
      timeout: 3000,
    });
  });

  test("score increments when a merge occurs", async ({ page }) => {
    // Start with two 2-tiles that will merge on ArrowLeft
    await injectGameState(
      page,
      midGameState({
        board: [
          [0, 2, 2, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 0,
      }),
    );
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    await page.keyboard.press("ArrowLeft");

    // Score should jump to 4 after 2+2 merge
    await expect(page.locator('[aria-label="Current score: 4"]')).toBeVisible({
      timeout: 3000,
    });
  });

  test("single-merge-per-move: [2,2,2,2] left → [4,4,…] not [8,…]", async ({
    page,
  }) => {
    await injectGameState(page, singleMergeState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    await page.keyboard.press("ArrowLeft");

    // Score should be 8 (4+4), not 16 (8+8) or 4 (just one merge)
    await expect(page.locator('[aria-label="Current score: 8"]')).toBeVisible({
      timeout: 3000,
    });
  });

  test("New Game button resets score to 0", async ({ page }) => {
    await injectGameState(page, midGameState({ score: 512 }));
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    await page.getByRole("button", { name: "Start a new 2048 game" }).click();

    await expect(page.locator('[aria-label="Current score: 0"]')).toBeVisible({
      timeout: 3000,
    });
  });

  test("Back button returns to Home", async ({ page }) => {
    await gotoTwenty48(page);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
