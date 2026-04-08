/**
 * cascade-leaderboard.spec.ts — GH #200
 *
 * Leaderboard integration: verifies that
 *   1. GET /cascade/scores is fetched when the game screen loads.
 *   2. POST /cascade/score is called with the correct payload when a score is
 *      submitted from the game-over overlay.
 *   3. The rank returned by the server is surfaced in the overlay.
 *   4. Rank 1 vs. mid-table ranks both render correctly.
 *
 * All network calls are intercepted via Playwright's `page.route()` — no real
 * backend is required.
 */

import { test, expect } from "@playwright/test";
import { gotoCascade, triggerGameOver } from "./helpers/cascade";

const API_BASE = "http://localhost:8000";
const SCORES_ENDPOINT = `${API_BASE}/cascade/scores`;
const SCORE_ENDPOINT = `${API_BASE}/cascade/score`;

test.describe("Cascade — leaderboard API integration", () => {
  // ---------------------------------------------------------------------------
  // Game loads cleanly when the leaderboard endpoint returns data
  // ---------------------------------------------------------------------------

  test("game screen loads without errors when leaderboard returns populated scores", async ({
    page,
  }) => {
    await page.route(`${API_BASE}/cascade/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          scores: [
            { player_name: "Alice", score: 1000, rank: 1 },
            { player_name: "Bob", score: 800, rank: 2 },
          ],
        }),
      });
    });

    await gotoCascade(page);

    // Game should still be playable — score display and canvas are visible
    await expect(page.getByText("Score", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Cascade game/i }),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // POST /cascade/score payload and rank display
  // ---------------------------------------------------------------------------

  test("submitting a score POSTs the correct payload to /cascade/score", async ({
    page,
  }) => {
    let capturedBody: Record<string, unknown> | null = null;

    await page.route(`${API_BASE}/cascade/**`, async (route) => {
      if (route.request().method() === "POST") {
        capturedBody = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ player_name: "Alice", score: 0, rank: 1 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ scores: [] }),
        });
      }
    });

    await gotoCascade(page);
    await triggerGameOver(page);

    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Alice");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(page.getByText("Saved! #1")).toBeVisible({ timeout: 5_000 });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.player_name).toBe("Alice");
    expect(typeof capturedBody!.score).toBe("number");
  });

  // ---------------------------------------------------------------------------
  // Rank display scenarios
  // ---------------------------------------------------------------------------

  test("rank 1 response renders 'Saved! #1'", async ({ page }) => {
    await page.route(SCORE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ player_name: "Alice", score: 500, rank: 1 }),
      });
    });
    await page.route(SCORES_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scores: [] }),
      });
    });

    await gotoCascade(page);
    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Alice");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(page.getByText("Saved! #1")).toBeVisible({ timeout: 5_000 });
  });

  test("rank 42 response renders 'Saved! #42'", async ({ page }) => {
    await page.route(SCORE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ player_name: "Bob", score: 100, rank: 42 }),
      });
    });
    await page.route(SCORES_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scores: [] }),
      });
    });

    await gotoCascade(page);
    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Bob");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(page.getByText("Saved! #42")).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // 429 rate-limit response
  // ---------------------------------------------------------------------------

  test("429 response from server → queues score locally for retry", async ({
    page,
  }) => {
    await page.route(SCORE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Too Many Requests" }),
      });
    });
    await page.route(SCORES_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scores: [] }),
      });
    });

    await gotoCascade(page);
    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByPlaceholder("Enter your name").fill("Tester");
    await page.getByRole("button", { name: "Save score" }).click();

    await expect(
      page.getByText("Saved locally"),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Empty name → button disabled, no request sent
  // ---------------------------------------------------------------------------

  test("Save Score button is disabled when name is empty", async ({ page }) => {
    let postCalled = false;

    await page.route(`${API_BASE}/cascade/**`, async (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scores: [] }),
      });
    });

    await gotoCascade(page);
    await triggerGameOver(page);
    await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible({
      timeout: 5_000,
    });

    // Do NOT fill in a name — button should be disabled
    const saveBtn = page.getByRole("button", { name: "Save score" });
    await expect(saveBtn).toBeDisabled();

    // Attempt a click anyway — no POST should fire
    await saveBtn.click({ force: true });
    await page.waitForTimeout(300);
    expect(postCalled).toBe(false);
  });
});
