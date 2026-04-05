/**
 * twenty48-game-over.spec.ts — GH #211
 *
 * Game-over detection and flow:
 *   Inject game-over state → overlay shows → input blocked →
 *   New Game resets → storage cleared
 */

import { test, expect } from "@playwright/test";
import {
  injectGameState,
  gameOverState,
  midGameState,
} from "./helpers/twenty48";

test.describe("2048 — game-over detection and flow", () => {
  test("game-over overlay shows when game_over=true", async ({ page }) => {
    await injectGameState(page, gameOverState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor({ timeout: 5000 });

    await expect(page.getByText("Game Over")).toBeVisible();
  });

  test("game-over overlay shows New Game and Home buttons", async ({
    page,
  }) => {
    await injectGameState(page, gameOverState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByText("Game Over").waitFor();

    await expect(
      page.getByRole("button", { name: "Start a new 2048 game" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quit and return to home screen" }),
    ).toBeVisible();
  });

  test("moves are blocked when game_over is true", async ({ page }) => {
    await injectGameState(page, gameOverState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByText("Game Over").waitFor();

    const emptyBefore = await page.getByLabel("empty").count();

    // Attempt moves — handleMove early-returns on game_over
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");

    // Board unchanged: empty count stays the same
    await expect(page.getByLabel("empty")).toHaveCount(emptyBefore);
    // Overlay still visible
    await expect(page.getByText("Game Over")).toBeVisible();
  });

  test("New Game from overlay resets score to 0 and dismisses overlay", async ({
    page,
  }) => {
    await injectGameState(page, gameOverState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByText("Game Over").waitFor();

    await page.getByRole("button", { name: "Start a new 2048 game" }).click();

    await expect(page.getByText("Game Over")).not.toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByLabel("Current score: 0")).toBeVisible({
      timeout: 3000,
    });
    // Fresh board has 2 tiles → 14 empty cells
    await expect(page.getByLabel("empty")).toHaveCount(14, { timeout: 3000 });
  });

  test("localStorage cleared after game-over transition", async ({ page }) => {
    await injectGameState(page, gameOverState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByText("Game Over").waitFor();

    // The clearGame() effect fires when game_over=true is loaded
    const stored = await page.evaluate(() =>
      localStorage.getItem("twenty48_game_v1"),
    );
    expect(stored).toBeNull();
  });

  test("full board with adjacent match available is NOT game-over", async ({
    page,
  }) => {
    // Row 0 has [2,2,4,8]: two adjacent 2s → not game over even if fully packed
    await injectGameState(page, {
      board: [
        [2, 2, 4, 8],
        [4, 8, 16, 32],
        [8, 16, 32, 64],
        [16, 32, 64, 128],
      ],
      score: 0,
      game_over: false,
      has_won: false,
    });
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    await expect(page.getByText("Game Over")).not.toBeVisible();
  });

  test("Home button in game-over overlay navigates back to Home", async ({
    page,
  }) => {
    await injectGameState(page, gameOverState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByText("Game Over").waitFor();

    await page
      .getByRole("button", { name: "Quit and return to home screen" })
      .click();

    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("game-over overlay absent for normal active game", async ({ page }) => {
    await injectGameState(page, midGameState());
    await page.getByRole("button", { name: "Play 2048" }).click();
    await page.getByLabel("Game board").waitFor();

    await expect(page.getByText("Game Over")).not.toBeVisible();
  });
});
