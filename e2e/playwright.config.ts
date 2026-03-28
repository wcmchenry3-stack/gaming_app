import { defineConfig, devices } from "@playwright/test";
import { join } from "path";

/**
 * Playwright E2E configuration.
 *
 * The webServer serves the pre-built Expo Web static export from
 * frontend/dist/.  In CI the build step runs separately before this job.
 * Locally, run `cd frontend && npx expo export --platform web` once first.
 *
 * The Yahtzee backend API (http://localhost:8000) is mocked via
 * page.route() in each test — no live backend is required.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { outputFolder: "playwright-report" }]] : "list",
  use: {
    baseURL: "http://localhost:8081",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx serve dist -p 8081 --single",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    cwd: join(__dirname, "..", "frontend"),
    timeout: 60_000,
  },
});
