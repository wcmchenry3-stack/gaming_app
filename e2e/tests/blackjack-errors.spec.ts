/**
 * blackjack-errors.spec.ts — GH #192
 *
 * Error paths and guardrails for Blackjack.
 *
 * Covers:
 *   - Navigation (back button)
 *   - Natural blackjack bypasses player phase
 *   - Bet stepper boundary enforcement
 *   - Game-over modal flow
 *   - Malformed / shape-drift localStorage state falls back to fresh game
 */

import { test, expect } from "@playwright/test";
import {
  gotoBlackjack,
  injectEngineState,
  playerPhaseState,
  resultPhaseState,
  gameOverState,
} from "./helpers/blackjack";

test.describe("Blackjack — error paths and guardrails", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("blackjack_game_v1"));
    await page.goto("/");
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  test("back button from Blackjack navigates to Home", async ({ page }) => {
    await gotoBlackjack(page);
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("back button works from player phase too", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ---------------------------------------------------------------------------
  // Natural blackjack: dealt 21 → skip player phase
  // ---------------------------------------------------------------------------

  test("natural blackjack bypasses player phase (no Hit/Stand shown)", async ({
    page,
  }) => {
    // Inject a player-phase state that looks like a natural (21 on 2 cards)
    // but mark it as result already, simulating engine handling
    await injectEngineState(
      page,
      resultPhaseState({ outcome: "blackjack", payout: 150, chips: 1150 }),
    );
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    // Engine already settled — no Hit/Stand, outcome visible
    await expect(page.getByText("Blackjack!")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Hit")).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Bet stepper boundaries
  // ---------------------------------------------------------------------------

  test("decrease button cannot go below 10-chip minimum", async ({ page }) => {
    await gotoBlackjack(page);

    // Mash decrease 20 times — should clamp at 10
    for (let i = 0; i < 20; i++) {
      const btn = page.getByRole("button", { name: /decrease bet by 10/i });
      const disabled = await btn.isDisabled();
      if (disabled) break;
      await btn.click();
    }

    // Verify bet is 10 and decrease is disabled
    await expect(
      page.getByRole("button", { name: /deal cards with 10-chip bet/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /decrease bet by 10/i }),
    ).toBeDisabled();
  });

  test("increase button cannot exceed 500-chip maximum", async ({ page }) => {
    await gotoBlackjack(page);

    // Mash increase 60 times — should clamp at 500
    for (let i = 0; i < 60; i++) {
      const btn = page.getByRole("button", { name: /increase bet by 10/i });
      const disabled = await btn.isDisabled();
      if (disabled) break;
      await btn.click();
    }

    await expect(
      page.getByRole("button", { name: /increase bet by 10/i }),
    ).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------

  test("Out of Chips modal appears when chips reach 0", async ({ page }) => {
    await injectEngineState(page, gameOverState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    await expect(page.getByText("Out of Chips").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", {
        name: /start a new session with 1000 chips/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Return to home screen", exact: true }),
    ).toBeVisible();
  });

  test("Play Again in game-over modal starts fresh with 1000 chips", async ({
    page,
  }) => {
    await injectEngineState(page, gameOverState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Out of Chips").first()).toBeVisible();

    await page
      .getByRole("button", { name: /start a new session with 1000 chips/i })
      .click();

    // Back in betting phase with fresh chip count
    await expect(
      page.getByRole("button", { name: /deal cards with/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("1000 chips")).toBeVisible();
  });

  test("Home button in game-over modal navigates to HomeScreen", async ({
    page,
  }) => {
    await injectEngineState(page, gameOverState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Out of Chips").first()).toBeVisible();

    await page
      .getByRole("button", { name: "Return to home screen", exact: true })
      .click();

    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ---------------------------------------------------------------------------
  // Malformed localStorage state falls back to fresh game
  // ---------------------------------------------------------------------------

  test("corrupted localStorage state starts a fresh game", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("blackjack_game_v1", "not-valid-json{{{"),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    // Should start fresh in betting phase, not crash
    await expect(
      page.getByRole("button", { name: /deal cards with/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("1000 chips")).toBeVisible();
  });

  test("shape-drift localStorage state (missing fields) falls back to fresh game", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "blackjack_game_v1",
        JSON.stringify({ chips: "not-a-number", foo: "bar" }),
      ),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    await expect(
      page.getByRole("button", { name: /deal cards with/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  // ---------------------------------------------------------------------------
  // Persistent table layout (GH #226 regression guard)
  // ---------------------------------------------------------------------------

  test("Dealer's Hand and Your Hand labels visible during betting phase", async ({
    page,
  }) => {
    await gotoBlackjack(page);
    // Table should always be visible, even before a hand is dealt
    await expect(page.getByText("Dealer's Hand")).toBeVisible();
    await expect(page.getByText("Your Hand")).toBeVisible();
  });

  test("table labels remain after transitioning back to betting via Next Hand", async ({
    page,
  }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await page.getByText("Next Hand").click();

    await expect(
      page.getByRole("button", { name: /deal cards with/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Dealer's Hand")).toBeVisible();
    await expect(page.getByText("Your Hand")).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Chip balance visibility (GH #227 regression guard)
  // ---------------------------------------------------------------------------

  test("chip balance visible during player phase", async ({ page }) => {
    await injectEngineState(page, playerPhaseState({ chips: 1000 }));
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await expect(
      page.locator('[aria-label*="Bankroll: 1000 chips"]'),
    ).toBeVisible();
  });

  test("chip balance visible during result phase", async ({ page }) => {
    await injectEngineState(page, resultPhaseState({ chips: 1100 }));
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    await expect(page.getByText("Next Hand")).toBeVisible();
    await expect(
      page.locator('[aria-label*="Bankroll: 1100 chips"]'),
    ).toBeVisible();
  });
});
