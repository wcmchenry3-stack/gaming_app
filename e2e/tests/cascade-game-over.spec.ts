/**
 * cascade-game-over.spec.ts — GH #199
 *
 * Game-over overlay behaviour: appearance, score save (success, offline, error),
 * and restart flow.
 *
 * `triggerGameOver()` instantly sets gameOver=true without waiting for physics
 * because `fastForward()` advances simulation steps but not Date.now(), so the
 * danger-line grace period would never fire via physics time alone.
 */

import { test, expect } from "@playwright/test";
import {
  gotoCascade,
  getState,
  triggerGameOver,
  mockLeaderboard,
} from "./helpers/cascade";

const API_BASE = "http://localhost:8000";
const SCORE_ENDPOINT_GLOB = `${API_BASE}/cascade/score/**`;

test.describe("Cascade — game-over overlay", () => {
  test.beforeEach(async ({ page }) => {
    await mockLeaderboard(page);
    await gotoCascade(page);
  });

  // ---------------------------------------------------------------------------
  // Overlay appearance
  // ---------------------------------------------------------------------------

  test("game-over overlay appears after triggerGameOver()", async ({
    page,
  }) => {
    await triggerGameOver(page);

    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("overlay shows name input and Save Score button", async ({ page }) => {
    await triggerGameOver(page);

    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByPlaceholder("Enter your name")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save score" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play again" }),
    ).toBeVisible();
  });

  test("getState().gameOver is true after triggerGameOver()", async ({
    page,
  }) => {
    await triggerGameOver(page);
    const state = await getState(page);
    expect(state.gameOver).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Successful score submission
  // ---------------------------------------------------------------------------

  test("Save Score with valid name → shows 'Saved! #1' confirmation", async ({
    page,
  }) => {
    await page.route(SCORE_ENDPOINT_GLOB, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ player_name: "Tester", score: 0, rank: 1 }),
        });
      } else {
        await route.continue();
      }
    });

    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Tester");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(page.getByText("Saved! #1")).toBeVisible({ timeout: 5_000 });
  });

  test("Save Score button is busy (ActivityIndicator) while submitting", async ({
    page,
  }) => {
    // Delay the response so we can observe the busy state
    await page.route(SCORE_ENDPOINT_GLOB, async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ player_name: "Tester", score: 0, rank: 2 }),
      });
    });

    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Tester");
    await page.getByRole("button", { name: "Save score" }).click();

    // During the 800 ms delay the button should report busy=true
    await expect(
      page.getByRole("button", { name: "Save score" }),
    ).toHaveJSProperty("disabled", true, { timeout: 500 });
  });

  // ---------------------------------------------------------------------------
  // Network failure → saved locally
  // ---------------------------------------------------------------------------

  test("fetch TypeError (network down) queues score locally → shows savedLocally text", async ({
    page,
  }) => {
    await page.route(SCORE_ENDPOINT_GLOB, async (route) => {
      await route.abort("failed");
    });

    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Tester");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(
      page.getByText("Saved locally — will submit when online"),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Server error → generic error message
  // ---------------------------------------------------------------------------

  test("non-2xx response → shows error message", async ({ page }) => {
    await page.route(SCORE_ENDPOINT_GLOB, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      });
    });

    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Tester");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(
      page.getByText("Could not save score. Check your connection."),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Play Again (restart)
  // ---------------------------------------------------------------------------

  test("Play Again button resets game — overlay disappears and score resets to 0", async ({
    page,
  }) => {
    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByRole("button", { name: "Play again" }).click();

    // Overlay should be gone
    await expect(
      page.getByRole("heading", { name: "Game Over" }),
    ).not.toBeVisible({ timeout: 3_000 });

    // Score display should be back to 0
    const state = await getState(page);
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
  });
});
