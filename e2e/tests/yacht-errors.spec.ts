/**
 * yacht-errors.spec.ts
 *
 * Error-path coverage for Yacht. After PR #156 ported the engine client-side,
 * backend-failure tests (503 on start, 400 on score) are obsolete — the
 * engine runs in-process and cannot hit those HTTP paths. What remains are
 * UI-level error surfaces driven by the local engine's exceptions, plus
 * navigation.
 */

import { test, expect } from "@playwright/test";

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
});
