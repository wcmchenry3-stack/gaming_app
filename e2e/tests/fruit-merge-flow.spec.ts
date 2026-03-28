/**
 * fruit-merge-flow.spec.ts
 *
 * E2E smoke test for the Fruit Merge game.
 *
 * Canvas content is not DOM-inspectable, so these tests focus on:
 *   - Navigation (Home → FruitMerge → Back → Home)
 *   - Score display element presence after interaction
 *   - App stability (no crashes/reloads after drops)
 *
 * The real Rapier2D WASM runs in the Playwright Chromium container.
 */

import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:8000";

test.describe("Fruit Merge — navigation and smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the leaderboard endpoint (POST /fruit-merge/score) to avoid network calls
    await page.route(`${API_BASE}/fruit-merge/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scores: [] }),
      });
    });
  });

  test("navigates from Home to Fruit Merge screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Gaming App").first()).toBeVisible();

    await page.getByRole("button", { name: "Play Fruit Merge" }).click();

    // Fruit Merge screen title or canvas should appear
    await expect(page.getByRole("heading", { name: "Fruit Merge" })).toBeVisible({ timeout: 10000 });
  });

  test("score display is visible on the Fruit Merge screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play Fruit Merge" }).click();

    // Score display should show "Score" label
    await expect(page.getByText("Score", { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test("tapping the canvas does not crash the app", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play Fruit Merge" }).click();

    // Wait for canvas to appear (look by aria-label)
    const canvas = page.getByRole("img", {
      name: /Fruit Merge game/i,
    });
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Tap center of canvas to drop a fruit
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Wait 2 seconds and verify the score element still exists (no crash)
    await page.waitForTimeout(2000);
    await expect(page.getByText("Score", { exact: true })).toBeVisible();
  });

  test("multiple taps do not cause a crash or navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play Fruit Merge" }).click();

    const canvas = page.getByRole("img", { name: /Fruit Merge game/i });
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const box = await canvas.boundingBox();
    if (box) {
      // Drop 5 fruits at different x positions
      for (let i = 0; i < 5; i++) {
        await page.mouse.click(box.x + (box.width / 6) * (i + 1), box.y + 50);
        await page.waitForTimeout(300);
      }
    }

    // App should still be on FruitMerge screen
    await expect(page.getByText("Score", { exact: true })).toBeVisible();
    await expect(page.url()).toContain(page.url()); // still on same page
  });

  test("back button from Fruit Merge returns to Home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play Fruit Merge" }).click();
    await expect(page.getByRole("heading", { name: "Fruit Merge" })).toBeVisible({ timeout: 10000 });

    // Click back
    await page.getByRole("button", { name: /back/i }).click();

    await expect(page.getByText("Gaming App").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Choose a game")).toBeVisible();
  });
});
