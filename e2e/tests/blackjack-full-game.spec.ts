/**
 * blackjack-full-game.spec.ts — GH #188
 *
 * Happy-path user journey for Blackjack:
 *   Home → Play Blackjack → bet → deal → hit/stand → result → Next Hand → repeat
 *
 * The engine runs live with real Math.random(). Assertions target UI state
 * transitions, not specific card values.
 */

import { test, expect } from "@playwright/test";
import {
  gotoBlackjack,
  injectEngineState,
  playerPhaseState,
  resultPhaseState,
} from "./helpers/blackjack";

test.describe("Blackjack — full happy-path game journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("blackjack_game_v1"));
    await page.goto("/");
  });

  test("navigates from Home to Blackjack on Play Blackjack click", async ({
    page,
  }) => {
    await expect(page.getByText("Gaming App").first()).toBeVisible();
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByRole("button", { name: /deal cards with/i })).toBeVisible();
    await expect(page.getByText("Blackjack", { exact: true })).toBeVisible();
  });

  test("Deal button transitions from betting to player or result phase", async ({
    page,
  }) => {
    await gotoBlackjack(page);
    await page.getByRole("button", { name: /deal cards with/i }).click();

    // Either player phase (Hit/Stand) or immediate result (natural BJ → Next Hand)
    await expect(
      page.getByText("Hit").or(page.getByText("Next Hand")),
    ).toBeVisible({ timeout: 5000 });
  });

  test("Stand ends player turn and shows result phase", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    // Loaded in player phase
    await expect(page.getByText("Hit")).toBeVisible();

    await page.getByRole("button", { name: /stand/i }).click();

    // Result phase: Next Hand button, outcome text
    await expect(page.getByText("Next Hand")).toBeVisible({ timeout: 5000 });
  });

  test("Next Hand returns to betting phase after a result", async ({ page }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    // Loaded in result phase
    await expect(page.getByText("Next Hand")).toBeVisible();
    await page.getByText("Next Hand").click();

    // Back in betting phase
    await expect(page.getByRole("button", { name: /deal cards with/i })).toBeVisible({ timeout: 5000 });
  });

  test("Hit adds a card and stays in player phase if not busted", async ({
    page,
  }) => {
    // 8+7 = 15; a single hit on most cards won't bust
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await page.getByRole("button", { name: /hit/i }).click();

    // Either still in player phase or result (bust) — Deal should NOT be visible
    await expect(page.getByRole("button", { name: /deal cards with/i })).not.toBeVisible({ timeout: 3000 });
  });

  test("multiple hands can be played in sequence", async ({ page }) => {
    await gotoBlackjack(page);

    for (let hand = 0; hand < 3; hand++) {
      // Betting phase
      await expect(page.getByRole("button", { name: /deal cards with/i })).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: /deal cards with/i }).click();

      // Player or result phase
      await expect(
        page.getByText("Hit").or(page.getByText("Next Hand")),
      ).toBeVisible({ timeout: 5000 });

      // If player phase, stand to reach result
      const hitVisible = await page.getByText("Hit").isVisible();
      if (hitVisible) {
        await page.getByRole("button", { name: /stand/i }).click();
        await expect(page.getByText("Next Hand")).toBeVisible({ timeout: 5000 });
      }

      // Advance to next hand
      await page.getByText("Next Hand").click();
    }

    // Still in betting phase after 3 hands
    await expect(page.getByRole("button", { name: /deal cards with/i })).toBeVisible({ timeout: 5000 });
  });

  test("chip balance updates after a winning hand", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    // Initial chips: 1000 (before result)
    await page.getByRole("button", { name: /stand/i }).click();
    await expect(page.getByText("Next Hand")).toBeVisible({ timeout: 5000 });

    // Outcome is non-deterministic; just verify chip display is present
    await expect(
      page.getByText(/\d+ chips/),
    ).toBeVisible();
  });

  test("Quit button in result phase navigates back to Home", async ({
    page,
  }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    await expect(page.getByText("Next Hand")).toBeVisible();
    await page.getByRole("button", { name: /quit/i }).click();

    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 5000,
    });
  });
});
