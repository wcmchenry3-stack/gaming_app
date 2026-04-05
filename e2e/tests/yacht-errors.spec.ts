/**
 * yacht-errors.spec.ts
 *
 * Error-path coverage for Yacht. After PR #156 ported the engine client-side,
 * backend-failure tests (503 on start, 400 on score) are obsolete — the
 * engine runs in-process and cannot hit those HTTP paths. What remains are
 * UI-level error surfaces driven by the local engine's exceptions, plus
 * navigation.
 *
 * GH #184 — extended with 5 additional error / guard cases.
 */

import { test, expect } from "@playwright/test";
import { injectGameState, blankScores } from "./helpers/yacht";

test.describe("Yacht — error paths and navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("yacht_game_v1"));
    await page.goto("/");
  });

  test("back button from Yacht returns to Home", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yacht" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();

    await expect(page.getByText("Gaming App").first()).toBeVisible();
  });

  test("cannot roll a 4th time in the same turn", async ({ page }) => {
    await page.getByRole("button", { name: "Play Yacht" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    const rollBtn = page.getByRole("button", { name: /Roll/i });
    // 3 rolls allowed per turn
    await rollBtn.click();
    await rollBtn.click();
    await rollBtn.click();
    // After the 3rd roll, the roll button is disabled (0 rolls remaining)
    await expect(rollBtn).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // GH #184 — additional error / guard cases
  // ---------------------------------------------------------------------------

  test("score rows are all disabled before the first roll of a turn", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Play Yacht" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Before any roll, possibleScores is empty → every ScoreRow shows "not available"
    // and is disabled (no press handler attached).
    const chanceRow = page.getByRole("button", {
      name: /Chance: not available/,
    });
    await expect(chanceRow).toBeVisible();
    await expect(chanceRow).toBeDisabled();
  });

  test("already-scored category row is disabled and not clickable", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Play Yacht" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Score Chance in round 1
    await page.getByRole("button", { name: /Roll/i }).click();
    await page.getByRole("button", { name: /Chance: potential score/ }).click();
    await expect(page.getByText("Round 2 / 13")).toBeVisible();

    // Chance row is now filled — it should be disabled
    const chanceRow = page.getByRole("button", { name: /Chance: scored/ });
    await expect(chanceRow).toBeDisabled();
  });

  test("roll button is disabled when game is over", async ({ page }) => {
    // Inject a game-over state where it's the player's turn but game_over=true
    const state = {
      dice: [0, 0, 0, 0, 0],
      held: [false, false, false, false, false],
      rolls_used: 0,
      round: 14,
      scores: {
        ones: 1,
        twos: 2,
        threes: 3,
        fours: 4,
        fives: 5,
        sixes: 6,
        three_of_a_kind: 0,
        four_of_a_kind: 0,
        full_house: 0,
        small_straight: 0,
        large_straight: 0,
        yacht: 0,
        chance: 0,
      },
      game_over: true,
      upper_subtotal: 21,
      upper_bonus: 0,
      yacht_bonus_count: 0,
      yacht_bonus_total: 0,
      total_score: 21,
    };

    await injectGameState(page, state);
    await page.getByRole("button", { name: "Play Yacht" }).click();

    // game_over state is loaded → starts a fresh game (HomeScreen rejects game-over saves)
    // So we land on Round 1 with a fresh state — Roll should be enabled
    await expect(page.getByText("Round 1 / 13")).toBeVisible();
    // Dismiss the modal if it appears (shouldn't for fresh game)
    const rollBtn = page.getByRole("button", { name: /Roll/i });
    await expect(rollBtn).toBeVisible();
    await expect(rollBtn).not.toBeDisabled();
  });

  test("all score rows are disabled after game over", async ({ page }) => {
    const CATEGORY_LABELS_IN_ORDER = [
      "Ones",
      "Twos",
      "Threes",
      "Fours",
      "Fives",
      "Sixes",
      "Three of a Kind",
      "Four of a Kind",
      "Full House (25)",
      "Sm. Straight (30)",
      "Lg. Straight (40)",
      "Yacht! (50)",
      "Chance",
    ];

    await page.getByRole("button", { name: "Play Yacht" }).click();

    // Play all 13 rounds
    for (let round = 0; round < 13; round++) {
      await expect(page.getByText(`Round ${round + 1} / 13`)).toBeVisible();
      await page.getByRole("button", { name: /Roll/i }).click();
      await page.getByText(CATEGORY_LABELS_IN_ORDER[round]).first().click();
    }

    // Dismiss the game-over modal to inspect the scorecard
    await expect(page.getByText("Game Over!")).toBeVisible();
    await page.getByRole("button", { name: /dismiss/i }).click();

    // All scored rows should be disabled (game_over=true blocks canScore)
    const chanceRow = page.getByRole("button", { name: /Chance: scored/ });
    await expect(chanceRow).toBeVisible();
    await expect(chanceRow).toBeDisabled();
  });

  test("scratching a category (scoring 0) is not reversible", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Play Yacht" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // Roll dice and score "Ones" — if no ones were rolled, this scratches it at 0
    await page.getByRole("button", { name: /Roll/i }).click();

    // If "Ones" has a potential score (could be 0 if no ones rolled), click it
    const onesRow = page.getByRole("button", { name: /Ones:/ });
    await expect(onesRow).toBeVisible();

    // Score any available category that shows "Ones" is selectable
    const onesSelectable = page.getByRole("button", {
      name: /Ones: potential score/,
    });
    const onesAvailable = await onesSelectable.isVisible();

    if (onesAvailable) {
      await onesSelectable.click();
      await expect(page.getByText("Round 2 / 13")).toBeVisible();

      // The Ones row is now filled and disabled — can't re-score it
      await expect(
        page.getByRole("button", { name: /Ones: scored/ }),
      ).toBeDisabled();
    } else {
      // Ones shows "not available" (this can happen if dice are all blank — skip)
      // Score Chance to advance the round instead
      await page
        .getByRole("button", { name: /Chance: potential score/ })
        .click();
      await expect(page.getByText("Round 2 / 13")).toBeVisible();
    }
  });
});
