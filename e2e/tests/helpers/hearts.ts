import { Page } from "@playwright/test";

const STORAGE_KEY = "hearts_game";

export async function mockHeartsApi(page: Page): Promise<void> {
  // Use **/hearts/** glob so the route matches regardless of the base URL
  // baked into the bundle (EXPO_PUBLIC_API_URL at export time).
  await page.route("**/hearts/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scores: [] }),
    });
  });
}

export async function gotoHearts(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.getByRole("button", { name: "Play Hearts" }).click();
  await page
    .getByRole("heading", { name: "Hearts", exact: true })
    .waitFor({ timeout: 10_000 });
}

export async function injectHeartsState(
  page: Page,
  partial: Record<string, unknown>,
): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ([key, state]) =>
      localStorage.setItem(key as string, JSON.stringify(state)),
    [STORAGE_KEY, partial] as const,
  );
  await page.goto("/");
}
