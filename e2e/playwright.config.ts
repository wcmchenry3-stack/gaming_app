import { defineConfig, devices } from "@playwright/test";
import { join } from "path";

/**
 * Playwright E2E configuration.
 *
 * Named projects allow CI to run only the impacted game suite on dev PRs
 * while always running the full suite on main PRs / pushes.
 *
 * Projects:
 *   yacht      — yacht-*.spec.ts
 *   blackjack  — blackjack-*.spec.ts
 *   twenty48   — twenty48-*.spec.ts
 *   pachisi    — pachisi-*.spec.ts
 *   cross      — accessibility.spec.ts, cascade-flow.spec.ts, ui-preferences.spec.ts
 *
 * In CI the e2e job passes --project flags based on dorny/paths-filter output.
 * Locally, `npx playwright test` runs all projects (no --project flag needed).
 *
 * The webServer serves the pre-built Expo Web static export from
 * frontend/dist/.  In CI the build step runs separately before this job.
 * Locally, run `cd frontend && npx expo export --platform web` once first.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: "http://localhost:8081",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "yacht",
      testMatch: "yacht-*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "blackjack",
      testMatch: "blackjack-*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "twenty48",
      testMatch: "twenty48-*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "pachisi",
      testMatch: "pachisi-*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "cascade",
      testMatch: "cascade-*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "cross",
      testMatch: [
        "accessibility.spec.ts",
        "ui-preferences.spec.ts",
      ],
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
