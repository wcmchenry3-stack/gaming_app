/**
 * blackjack-accessibility.spec.ts — GH #193
 *
 * Accessibility smoke tests for the Blackjack screen.
 *
 * Verifies:
 *   - ARIA labels on all interactive controls
 *   - Card accessibility labels (face-up and face-down)
 *   - Chip balance accessible label
 *   - axe-core scan passes on betting, player, and result phases
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  gotoBlackjack,
  injectEngineState,
  playerPhaseState,
  resultPhaseState,
} from "./helpers/blackjack";

test.describe("Blackjack — accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("blackjack_game_v1"));
    await page.goto("/");
  });

  // ---------------------------------------------------------------------------
  // Navigation / header controls
  // ---------------------------------------------------------------------------

  test("back button has an accessible label", async ({ page }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("button", { name: /back/i }),
    ).toBeVisible();
  });

  test("theme toggle button has an accessible label", async ({ page }) => {
    await gotoBlackjack(page);
    // Label is "Switch to dark mode" or "Switch to light mode"
    await expect(
      page.getByRole("button", { name: /mode/i }),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Betting phase
  // ---------------------------------------------------------------------------

  test("chip balance has accessible label in betting phase", async ({
    page,
  }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("text", { name: /you have 1000 chips/i }).or(
        page.locator('[aria-label*="You have 1000 chips"]'),
      ),
    ).toBeVisible();
  });

  test("bet stepper controls have accessible labels", async ({ page }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("button", { name: /decrease bet by 10/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /increase bet by 10/i }),
    ).toBeVisible();
  });

  test("current bet amount has accessible label", async ({ page }) => {
    await gotoBlackjack(page);
    await expect(
      page.locator('[aria-label*="Current bet: 100 chips"]'),
    ).toBeVisible();
  });

  test("Deal button has accessible label including bet amount", async ({
    page,
  }) => {
    await gotoBlackjack(page);
    await expect(
      page.getByRole("button", { name: /deal cards with 100-chip bet/i }),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Player phase
  // ---------------------------------------------------------------------------

  test("Hit button has accessible label", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /hit — take another card/i }),
    ).toBeVisible();
  });

  test("Stand button has accessible label", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /stand — end your turn/i }),
    ).toBeVisible();
  });

  test("Double Down button has accessible label when available", async ({
    page,
  }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /double down — double bet/i }),
    ).toBeVisible();
  });

  test("Double Down button has accessible disabled label when not available", async ({
    page,
  }) => {
    // 3-card hand → double not available
    await injectEngineState(
      page,
      playerPhaseState({
        player_hand: [
          { suit: "♠", rank: "3" },
          { suit: "♥", rank: "4" },
          { suit: "♣", rank: "5" },
        ],
      }),
    );
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /double down not available/i }),
    ).toBeDisabled();
  });

  test("chip balance strip has accessible label in player phase", async ({
    page,
  }) => {
    await injectEngineState(page, playerPhaseState({ chips: 1000 }));
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    await expect(
      page.locator('[aria-label*="You have 1000 chips"]'),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Cards accessibility
  // ---------------------------------------------------------------------------

  test("face-up player cards have rank and suit in accessible label", async ({
    page,
  }) => {
    // player hand: 8♠ and 7♥
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    // "8 of Spades" or similar (i18n expands the suit symbol)
    await expect(
      page.locator('[aria-label*="8 of Spades"]').or(
        page.locator('[role="img"][aria-label*="8"]'),
      ),
    ).toBeVisible();
  });

  test("face-down dealer hole card has accessible label", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    // Dealer hole card is concealed during player phase
    await expect(
      page.locator('[aria-label="Face-down card"]'),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Result phase
  // ---------------------------------------------------------------------------

  test("Next Hand button has accessible label in result phase", async ({
    page,
  }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Next Hand")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /start the next hand/i }),
    ).toBeVisible();
  });

  test("Quit button has accessible label in result phase", async ({ page }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Next Hand")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /quit and return to home screen/i }),
    ).toBeVisible();
  });

  test("payout text has accessible label in result phase", async ({ page }) => {
    await injectEngineState(page, resultPhaseState({ payout: 100 }));
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Next Hand")).toBeVisible();

    await expect(
      page.locator('[aria-label*="Payout: 100 chips"]'),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // axe-core automated scan
  // ---------------------------------------------------------------------------

  test("no critical axe violations during betting phase", async ({ page }) => {
    await gotoBlackjack(page);
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"]) // theme-dependent; checked manually
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });

  test("no critical axe violations during player phase", async ({ page }) => {
    await injectEngineState(page, playerPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Hit")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });

  test("no critical axe violations during result phase", async ({ page }) => {
    await injectEngineState(page, resultPhaseState());
    await page.getByRole("button", { name: "Play Blackjack" }).click();
    await expect(page.getByText("Next Hand")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });
});
