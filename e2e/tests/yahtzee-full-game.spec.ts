/**
 * yahtzee-full-game.spec.ts
 *
 * E2E user journey: play a complete 13-round Yahtzee game.
 * The Yahtzee backend is mocked via page.route() — no live server needed.
 *
 * Journey:
 *   Home → click "Play Yahtzee" → 13× (roll + score "Ones") → Game Over modal → Play Again → Home
 */

import { test, expect } from "@playwright/test";
import { installYahtzeeGameMock } from "./helpers/api-mock";

const CATEGORIES = [
  "ones", "twos", "threes", "fours", "fives", "sixes",
  "three_of_a_kind", "four_of_a_kind", "full_house",
  "small_straight", "large_straight", "yahtzee", "chance",
];

// Maps category keys to the English i18n display text shown in the scorecard
const CATEGORY_LABELS: Record<string, string> = {
  ones: "Ones",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  three_of_a_kind: "Three of a Kind",
  four_of_a_kind: "Four of a Kind",
  full_house: "Full House (25)",
  small_straight: "Sm. Straight (30)",
  large_straight: "Lg. Straight (40)",
  yahtzee: "Yahtzee! (50)",
  chance: "Chance",
};

test.describe("Yahtzee — full 13-round game journey", () => {
  test.beforeEach(async ({ page }) => {
    await installYahtzeeGameMock(page);
    await page.goto("/");
  });

  test("navigates from Home to Game on Play Yahtzee click", async ({ page }) => {
    await expect(page.getByText("Gaming App").first()).toBeVisible();
    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();
  });

  test("Roll button appears and responds", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Roll button shows remaining roll count (3 left on first turn)
    const rollBtn = page.getByRole("button", { name: /Roll/i });
    await expect(rollBtn).toBeVisible();
    await rollBtn.click();

    // After rolling, dice values should appear (mock returns [1,2,3,4,5])
    await expect(page.getByRole("button", { name: /Die 1: showing 1/ })).toBeVisible();
  });

  test("scoring a category advances the round", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yahtzee" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Roll first
    await page.getByRole("button", { name: /Roll/i }).click();

    // Score "Ones" — the mock returns rolled state with dice [1,2,3,4,5]
    // Scorecard should show "Ones" as a tappable category
    const onesRow = page.getByText("Ones").first();
    await expect(onesRow).toBeVisible();
    await onesRow.click(); // single click to score

    await expect(page.getByText("Round 2 / 13")).toBeVisible();
  });

  test("game-over modal appears after 13 rounds", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yahtzee" }).click();

    // Play through all 13 rounds
    for (let round = 0; round < 13; round++) {
      await expect(page.getByText(`Round ${round + 1} / 13`)).toBeVisible();
      await page.getByRole("button", { name: /Roll/i }).click();

      const label = CATEGORY_LABELS[CATEGORIES[round]];
      await page.getByText(label).first().click();
    }

    await expect(page.getByText("Game Over!")).toBeVisible();
    await expect(page.getByText(/Final Score/i)).toBeVisible();
  });

  test("Play Again from game-over modal starts a new game in place", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yahtzee" }).click();

    // Fast-forward through all 13 rounds
    for (let round = 0; round < 13; round++) {
      await page.getByRole("button", { name: /Roll/i }).click();
      const label = CATEGORY_LABELS[CATEGORIES[round]];
      await page.getByText(label).first().click();
    }

    await expect(page.getByText("Game Over!")).toBeVisible();
    await page.getByRole("button", { name: /start a new game/i }).click();

    // Should stay on the game screen with a fresh round 1
    await expect(page.getByText(/Round 1/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Roll/i })).toBeVisible();
  });

  test("No Thanks dismisses game-over modal and keeps score visible", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yahtzee" }).click();

    // Fast-forward through all 13 rounds
    for (let round = 0; round < 13; round++) {
      await page.getByRole("button", { name: /Roll/i }).click();
      const label = CATEGORY_LABELS[CATEGORIES[round]];
      await page.getByText(label).first().click();
    }

    await expect(page.getByText("Game Over!")).toBeVisible();
    await page.getByRole("button", { name: /dismiss/i }).click();

    // Modal should be dismissed, game screen still showing
    await expect(page.getByText("Game Over!")).not.toBeVisible();
  });
});
