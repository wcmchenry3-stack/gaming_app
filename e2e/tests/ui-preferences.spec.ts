/**
 * ui-preferences.spec.ts
 *
 * E2E tests for theme toggle and language switcher.
 *
 * Theme: toggles between dark/light mode — verifies the toggle button label changes.
 * Language: switching to a non-English locale changes visible UI copy.
 */

import { test, expect } from "@playwright/test";
import { installYachtGameMock } from "./helpers/api-mock";

test.describe("Theme toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("theme toggle button is visible on Home", async ({ page }) => {
    // The button shows either "Light mode" or "Dark mode" text
    const toggle = page.getByRole("button", { name: /mode/i });
    await expect(toggle).toBeVisible();
  });

  test("clicking theme toggle changes the button label", async ({ page }) => {
    const toggle = page.getByRole("button", { name: /mode/i });
    const initialLabel = await toggle.textContent();

    await toggle.click();

    // Label should have changed (light ↔ dark)
    const newLabel = await toggle.textContent();
    expect(newLabel).not.toBe(initialLabel);
  });

  test("theme toggle persists into Yacht game screen", async ({ page }) => {
    await installYachtGameMock(page);

    // Switch theme first
    const toggle = page.getByRole("button", { name: /mode/i });
    await toggle.click();
    const themeAfterToggle = await toggle.textContent();

    // Navigate to game
    await page.getByRole("button", { name: "Play Yacht" }).click();
    await expect(page.getByText("Round 1 / 13")).toBeVisible();

    // The game screen also has a theme toggle; its label should match
    const gameToggle = page.getByRole("button", { name: /mode/i });
    await expect(gameToggle).toBeVisible();
    const gameToggleLabel = await gameToggle.textContent();
    expect(gameToggleLabel).toBe(themeAfterToggle);
  });
});

test.describe("Language switcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("language switcher is visible on Home", async ({ page }) => {
    // Language switcher has accessibilityLabel "Select language"
    await expect(page.getByRole("combobox", { name: /language/i })).toBeVisible();
  });

  test("switching to Spanish shows Spanish UI copy", async ({ page }) => {
    const switcher = page.getByRole("combobox", { name: /language/i });
    await switcher.selectOption("es");

    // Spanish locale: "game.playLabel" = "Jugar Yacht"
    await expect(page.getByRole("button", { name: "Jugar Yacht" })).toBeVisible({
      timeout: 3000,
    });
  });

  test("switching to German shows German UI copy", async ({ page }) => {
    const switcher = page.getByRole("combobox", { name: /language/i });
    await switcher.selectOption("de");

    // German: "game.playLabel" for yacht
    await expect(page.getByRole("button", { name: "Yacht spielen" })).toBeVisible({
      timeout: 3000,
    });
  });

  test("switching language and back to English restores English copy", async ({ page }) => {
    // Use the <select> element directly — its accessible name changes locale after selection
    const switcher = page.locator("select").first();

    await switcher.selectOption("es");
    await expect(page.getByRole("button", { name: "Jugar Yacht" })).toBeVisible({
      timeout: 3000,
    });

    await switcher.selectOption("en");
    await expect(page.getByRole("button", { name: "Play Yacht" })).toBeVisible({
      timeout: 3000,
    });
  });
});
