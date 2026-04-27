/**
 * freecell-smoke.spec.ts — GH #910
 *
 * Smoke tests for FreeCell: navigation, HUD display, board accessibility,
 * and crash-free interaction.
 *
 * FreeCell's board is DOM-based (React Native View components), not canvas.
 * All backend API calls are intercepted via page.route() — no backend needed.
 */

import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:8000";

test.describe("FreeCell — smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${API_BASE}/freecell/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scores: [] }),
      });
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("freecell_game");
    });
  });

  test("navigates from Home to FreeCell screen", async ({ page }) => {
    await page.getByRole("button", { name: "Play FreeCell" }).click();
    await expect(
      page.getByRole("heading", { name: "FreeCell", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("move counter is visible", async ({ page }) => {
    await page.getByRole("button", { name: "Play FreeCell" }).click();
    await expect(
      page.getByRole("heading", { name: "FreeCell", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Moves:\s*\d+/)).toBeVisible({ timeout: 5_000 });
  });

  test("board region is accessible", async ({ page }) => {
    await page.getByRole("button", { name: "Play FreeCell" }).click();
    await expect(
      page.getByRole("heading", { name: "FreeCell", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByLabel("FreeCell board"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("interacting with the board does not crash the app", async ({ page }) => {
    await page.getByRole("button", { name: "Play FreeCell" }).click();
    await expect(
      page.getByRole("heading", { name: "FreeCell", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    const board = page.getByLabel("FreeCell board");
    await expect(board).toBeVisible({ timeout: 5_000 });

    const box = await board.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    await expect(page.getByRole("alert")).not.toBeVisible();
    await expect(page.getByText(/Moves:\s*\d+/)).toBeVisible({ timeout: 5_000 });
  });
});
