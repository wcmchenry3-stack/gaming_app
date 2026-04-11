/**
 * ui-preferences.spec.ts
 *
 * E2E tests for the theme toggle and language switcher, both of which live
 * on the Settings tab (the lobby redesign in #309 moved them off Home).
 *
 * Theme: toggles between dark/light mode — verifies the toggle button label changes.
 * Language: switching to a non-English locale changes visible UI copy.
 */

import { test, expect } from "@playwright/test";

async function gotoSettings(page: import("@playwright/test").Page) {
  await page.goto("/");
  // BottomTabBar exposes each tab with role=tab + accessibilityLabel="Settings".
  // The tab labels are hardcoded in TAB_ITEMS so they don't localize.
  await page.getByRole("tab", { name: "Settings" }).click();
  // Wait for the theme toggle to render before the test starts interacting.
  await expect(page.getByTestId("theme-toggle-button")).toBeVisible();
}

test.describe("Theme toggle", () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettings(page);
  });

  test("theme toggle button is visible in Settings", async ({ page }) => {
    await expect(page.getByTestId("theme-toggle-button")).toBeVisible();
  });

  test("clicking theme toggle changes the button label", async ({ page }) => {
    const toggle = page.getByTestId("theme-toggle-button");
    const initialLabel = await toggle.textContent();

    await toggle.click();

    const newLabel = await toggle.textContent();
    expect(newLabel).not.toBe(initialLabel);
  });

  test("theme toggle persists across tab navigation", async ({ page }) => {
    const toggle = page.getByTestId("theme-toggle-button");
    await toggle.click();
    const labelAfterToggle = await toggle.textContent();

    // Navigate away and back via the bottom tab bar.
    await page.getByRole("tab", { name: "Lobby" }).click();
    await page.getByRole("tab", { name: "Settings" }).click();

    const labelAfterNav = await page.getByTestId("theme-toggle-button").textContent();
    expect(labelAfterNav).toBe(labelAfterToggle);
  });
});

test.describe("Language switcher", () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettings(page);
  });

  test("language switcher is visible in Settings", async ({ page }) => {
    await expect(page.getByTestId("lang-switcher-trigger")).toBeVisible();
  });

  test("switching to Spanish shows Spanish UI copy", async ({ page }) => {
    await page.getByTestId("lang-switcher-trigger").click();
    // Modal option accessibilityLabel is `${nativeLabel} — ${label}`; native labels
    // do not localize so "Español" is stable across the current UI language.
    await page.getByRole("button", { name: /Español/ }).click();

    // Return to lobby to verify card copy localized.
    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Jugar Yacht" })).toBeVisible({
      timeout: 3000,
    });
  });

  test("switching to German shows German UI copy", async ({ page }) => {
    await page.getByTestId("lang-switcher-trigger").click();
    await page.getByRole("button", { name: /Deutsch/ }).click();

    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Yacht spielen" })).toBeVisible({
      timeout: 3000,
    });
  });

  test("switching language and back to English restores English copy", async ({ page }) => {
    // ES first
    await page.getByTestId("lang-switcher-trigger").click();
    await page.getByRole("button", { name: /Español/ }).click();
    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Jugar Yacht" })).toBeVisible({
      timeout: 3000,
    });

    // Back to Settings — the trigger's aria-label is now localized, but testID is stable.
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByTestId("lang-switcher-trigger").click();
    await page.getByRole("button", { name: /English/ }).click();

    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Play Yacht" })).toBeVisible({
      timeout: 3000,
    });
  });
});
