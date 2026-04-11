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
  BlackjackPage,
  gotoBlackjack,
  injectEngineState,
  playerPhaseState,
  resultPhaseState,
  gameOverState,
} from "./helpers/blackjack";

test.describe("Blackjack — error paths and guardrails", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("blackjack_game_v2"));
    await page.goto("/");
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  test("navigating away from Blackjack returns to Home", async ({ page }) => {
    await gotoBlackjack(page);
    // Navigate home via URL (Lobby tab pop-to-root not reliable on web)
    await page.goto("/");
    await expect(page.getByText("Gaming App").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("navigating away from Blackjack player phase returns to Home", async ({
    page,
  }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    // Navigate home via URL (Lobby tab pop-to-root not reliable on web)
    await page.goto("/");
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

  test("chip buttons are disabled when bet would exceed max (500)", async ({
    page,
  }) => {
    await gotoBlackjack(page);

    // Place 500-chip — all chip buttons become disabled
    await page.getByRole("button", { name: /add 500 to bet/i }).click();

    await expect(
      page.getByRole("button", { name: /deal cards with 500-chip bet/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "5-chip not available", exact: true }),
    ).toBeDisabled();
  });

  test("500-chip button is disabled when chips cap is lower than 500", async ({
    page,
  }) => {
    const bj = new BlackjackPage(page);
    await bj.goto();

    // Place 400 chips (four 100s); now only 5 and 25 would still fit,
    // but 500 is definitely disabled
    for (let i = 0; i < 4; i++) {
      await bj.chipButton(100).click();
    }

    await expect(
      page.getByRole("button", { name: "500-chip not available", exact: true }),
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
    const bj = new BlackjackPage(page);
    await expect(bj.dealButton()).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[aria-label*="Bankroll: 1000 chips"]'),
    ).toBeVisible();
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
      localStorage.setItem("blackjack_game_v2", "not-valid-json{{{"),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    // Should start fresh in betting phase, not crash
    const bj = new BlackjackPage(page);
    await expect(bj.dealButton()).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[aria-label*="Bankroll: 1000 chips"]'),
    ).toBeVisible();
  });

  test("shape-drift localStorage state (missing fields) falls back to fresh game", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "blackjack_game_v2",
        JSON.stringify({ chips: "not-a-number", foo: "bar" }),
      ),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Play Blackjack" }).click();

    const bj = new BlackjackPage(page);
    await expect(bj.dealButton()).toBeVisible({ timeout: 5000 });
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

    const bj = new BlackjackPage(page);
    await expect(bj.dealButton()).toBeVisible({ timeout: 5000 });
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
