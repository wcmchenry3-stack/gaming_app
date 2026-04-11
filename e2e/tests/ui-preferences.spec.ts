/**
 * ui-preferences.spec.ts
 *
 * E2E tests for the theme toggle and language switcher, both of which live
 * on the Settings tab (the lobby redesign in #309/#326 moved them off Home).
 *
 * Theme: toggles between dark/light mode — verifies the toggle button label changes.
 * Language: switching to a non-English locale changes visible UI copy in the lobby.
 *
 * On web, LanguageSwitcher.web.tsx renders a native <select>, so tests use
 * .selectOption() directly. The testID is used instead of the aria-label
 * because the label localizes, which broke the round-trip test historically.
 */

import { test, expect, type Page } from "@playwright/test";

async function gotoSettings(page: Page) {
  await page.goto("/");
  // BottomTabBar exposes each tab with role=tab; initial load is English so
  // "Settings" is valid here — only mid-test locale switches change the label.
  await page.getByRole("tab", { name: "Settings" }).click();
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

    await page.getByRole("tab", { name: "Lobby" }).click();
    await page.getByRole("tab", { name: "Settings" }).click();

    const labelAfterNav = await page
      .getByTestId("theme-toggle-button")
      .textContent();
    expect(labelAfterNav).toBe(labelAfterToggle);
  });
});

test.describe("Language switcher", () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettings(page);
  });

  test("language switcher is visible in Settings", async ({ page }) => {
    await expect(page.getByTestId("lang-switcher-select")).toBeVisible();
  });

  test("switching to Spanish shows Spanish UI copy", async ({ page }) => {
    await page.getByTestId("lang-switcher-select").selectOption("es");

    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Jugar Yacht" })).toBeVisible(
      {
        timeout: 3000,
      },
    );
  });

  test("switching to German shows German UI copy", async ({ page }) => {
    await page.getByTestId("lang-switcher-select").selectOption("de");

    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(
      page.getByRole("button", { name: "Yacht spielen" }),
    ).toBeVisible({
      timeout: 3000,
    });
  });

  test("switching language and back to English restores English copy", async ({
    page,
  }) => {
    await page.getByTestId("lang-switcher-select").selectOption("es");

    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Jugar Yacht" })).toBeVisible(
      {
        timeout: 3000,
      },
    );

    // Back to Settings — UI is now in Spanish so the tab label is "Ajustes".
    // BottomTabBar uses t("nav.settings") so the accessible name localizes.
    await page.getByRole("tab", { name: "Ajustes" }).click();
    await page.getByTestId("lang-switcher-select").selectOption("en");

    await page.getByRole("tab", { name: "Lobby" }).click();
    await expect(page.getByRole("button", { name: "Play Yacht" })).toBeVisible({
      timeout: 3000,
    });
  });
});
