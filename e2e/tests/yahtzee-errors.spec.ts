/**
 * yahtzee-errors.spec.ts
 *
 * E2E error recovery journeys for the Yahtzee game:
 *   1. Backend 503 on game start → error message shown → retry succeeds
 *   2. User navigates back from game (sanity check for nav stack)
 */

import { test, expect } from "@playwright/test";
import { installFlakyNewGameMock, installYahtzeeGameMock } from "./helpers/api-mock";

const API_BASE = "http://localhost:8000";

test.describe("Yahtzee — error recovery", () => {
  test("shows error message when backend returns 503 on game start", async ({ page }) => {
    await installFlakyNewGameMock(page);
    await page.goto("/");

    // First click — mock returns 503
    await page.getByRole("button", { name: "Play Yahtzee" }).click();

    // Error message should appear on the HomeScreen
    await expect(page.getByText(/connection/i)).toBeVisible({ timeout: 5000 });

    // Still on Home (no navigation happened)
    await expect(page.getByText("Gaming App")).toBeVisible();
  });

  test("recovers and starts game after initial 503", async ({ page }) => {
    await installFlakyNewGameMock(page);
    await page.goto("/");

    // First click — fails
    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText(/connection/i)).toBeVisible({ timeout: 5000 });

    // Second click — succeeds (mock flips to 200 after first attempt)
    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible({ timeout: 5000 });
  });

  test("shows error message when scoring before rolling", async ({ page }) => {
    await installYahtzeeGameMock(page);

    // Override score endpoint to return 400
    await page.route(`${API_BASE}/game/score`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Must roll at least once before scoring." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Attempt to score without rolling — tap "Ones"
    const onesRow = page.getByText("Ones").first();
    await onesRow.click();

    // Error should appear in UI
    await expect(page.getByText(/Must roll/i)).toBeVisible({ timeout: 5000 });

    // Round should NOT have advanced
    await expect(page.getByText("Round 1 / 13")).toBeVisible();
  });

  test("back button from Yahtzee returns to Home", async ({ page }) => {
    await installYahtzeeGameMock(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Navigate back
    await page.getByRole("button", { name: /back/i }).click();

    await expect(page.getByText("Gaming App")).toBeVisible();
  });
});
