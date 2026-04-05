/**
 * blackjack-betting.spec.ts — GH #190
 *
 * Bet input stepper and Deal button interaction tests.
 *
 * BettingPanel rules:
 *   - Default bet: min(100, chips)
 *   - Stepper step: 10 chips
 *   - Min bet: 10, Max bet: min(500, chips)
 *   - Deal button disabled when bet < 10 or bet > chips
 */

import { test, expect } from "@playwright/test";
import { gotoBlackjack, injectEngineState, playerPhaseState, resultPhaseState } from "./helpers/blackjack";

test.describe("Blackjack — betting panel and bet stepper", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("blackjack_game_v1"));
    await page.goto("/");
  });

  test("default bet is 100 chips on a fresh game", async ({ page }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("button", { name: /deal cards with 100-chip bet/i }),
    ).toBeVisible();
  });

  test("chip balance is displayed in BettingPanel", async ({ page }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("text", { name: /you have 1000 chips/i }).or(
        page.getByText("1000 chips"),
      ),
    ).toBeVisible();
  });

  test("increase bet button raises bet by 10", async ({ page }) => {
    await gotoBlackjack(page);
    await page.getByRole("button", { name: /increase bet by 10/i }).click();

    // Default was 100 → now 110
    await expect(
      page.getByRole("button", { name: /deal cards with 110-chip bet/i }),
    ).toBeVisible();
  });

  test("decrease bet button lowers bet by 10", async ({ page }) => {
    await gotoBlackjack(page);
    await page.getByRole("button", { name: /decrease bet by 10/i }).click();

    // Default was 100 → now 90
    await expect(
      page.getByRole("button", { name: /deal cards with 90-chip bet/i }),
    ).toBeVisible();
  });

  test("decrease bet is disabled at minimum bet (10)", async ({ page }) => {
    await gotoBlackjack(page);

    // Click decrease 9 times: 100 → 10
    for (let i = 0; i < 9; i++) {
      await page.getByRole("button", { name: /decrease bet by 10/i }).click();
    }

    await expect(
      page.getByRole("button", { name: /decrease bet by 10/i }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /deal cards with 10-chip bet/i }),
    ).toBeVisible();
  });

  test("increase bet is disabled when bet reaches max (500 or chips)", async ({
    page,
  }) => {
    await gotoBlackjack(page);

    // Click increase 40 times: 100 → 500
    for (let i = 0; i < 40; i++) {
      await page.getByRole("button", { name: /increase bet by 10/i }).click();
    }

    await expect(
      page.getByRole("button", { name: /increase bet by 10/i }),
    ).toBeDisabled();
  });

  test("increase bet is capped at chip balance when chips < 500", async ({
    page,
  }) => {
    // Inject a state with low chip count
    await injectEngineState(
      page,
      playerPhaseState({ chips: 50, bet: 0, phase: "betting", outcome: null, payout: 0, player_hand: [], dealer_hand: [] }),
    );
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByRole("button", { name: /deal cards with/i })).toBeVisible();

    // Max bet should be 50 (equal to chips)
    // Try to increase past chips — button should become disabled before 500
    await expect(
      page.getByRole("button", { name: /increase bet by 10/i }),
    ).toBeDisabled();
  });

  test("Deal button is enabled when bet is valid", async ({ page }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("button", { name: /deal cards with 100-chip bet/i }),
    ).not.toBeDisabled();
  });

  test("pressing Deal with a valid bet starts the hand", async ({ page }) => {
    await gotoBlackjack(page);
    await page.getByRole("button", { name: /deal cards with 100-chip bet/i }).click();

    // Either player phase or natural blackjack result
    await expect(
      page.getByText("Hit").or(page.getByText("Next Hand")),
    ).toBeVisible({ timeout: 5000 });
  });

  test("Hit and Stand buttons are visible in player phase", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    await expect(
      page.getByRole("button", { name: /hit — take another card/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /stand — end your turn/i }),
    ).toBeVisible();
  });

  test("BettingPanel is not shown during player phase", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    // Deal button should not be visible
    await expect(page.getByRole("button", { name: /deal cards with/i })).not.toBeVisible();
  });

  test("BettingPanel returns after pressing Next Hand", async ({ page }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    await expect(page.getByText("Next Hand")).toBeVisible();
    await page.getByText("Next Hand").click();

    // BettingPanel with Deal button should be visible again
    await expect(page.getByRole("button", { name: /deal cards with/i })).toBeVisible({ timeout: 5000 });
  });
});
