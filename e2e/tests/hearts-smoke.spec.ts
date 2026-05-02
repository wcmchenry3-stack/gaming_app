/**
 * hearts-smoke.spec.ts — GH #1142
 *
 * Smoke tests: navigation, hand render, and trick area visibility.
 * All backend calls are intercepted — no running backend needed.
 */

import { test, expect } from "@playwright/test";
import { mockHeartsApi, gotoHearts } from "./helpers/hearts";

test.describe("Hearts — smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await mockHeartsApi(page);
    // gotoHearts navigates to "/" and clears hearts_game before entering the screen.
    await gotoHearts(page);
  });

  test("navigates from Home to Hearts screen", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Hearts", exact: true }),
    ).toBeVisible();
  });

  test("player hand renders with 13 cards", async ({ page }) => {
    await expect(
      page.getByLabel("Your hand, 13 cards"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("trick area is visible", async ({ page }) => {
    await expect(
      page.getByLabel("Current trick"),
    ).toBeVisible({ timeout: 5_000 });
  });
});
