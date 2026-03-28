/**
 * ludo-flow.spec.ts
 *
 * E2E smoke test for the Ludo game.
 * All /ludo/* API calls are mocked — no live backend required.
 */

import { test, expect, Page } from "@playwright/test";

const API_BASE = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Mock state factory
// ---------------------------------------------------------------------------

function makeLudoState(overrides: Record<string, unknown> = {}) {
  return {
    phase: "roll",
    players: ["red", "yellow"],
    current_player: "red",
    die_value: null,
    valid_moves: [],
    player_states: [
      {
        player_id: "red",
        pieces: [
          { index: 0, position: -1, is_home: true, is_finished: false },
          { index: 1, position: -1, is_home: true, is_finished: false },
          { index: 2, position: -1, is_home: true, is_finished: false },
          { index: 3, position: -1, is_home: true, is_finished: false },
        ],
        pieces_home: 4,
        pieces_finished: 0,
      },
      {
        player_id: "yellow",
        pieces: [
          { index: 0, position: -1, is_home: true, is_finished: false },
          { index: 1, position: -1, is_home: true, is_finished: false },
          { index: 2, position: -1, is_home: true, is_finished: false },
          { index: 3, position: -1, is_home: true, is_finished: false },
        ],
        pieces_home: 4,
        pieces_finished: 0,
      },
    ],
    winner: null,
    extra_turn: false,
    cpu_player: "yellow",
    last_event: null,
    ...overrides,
  };
}

// State after human rolls a 6 (can enter a piece from base)
const rolledSixState = makeLudoState({
  phase: "move",
  die_value: 6,
  valid_moves: [0, 1, 2, 3],
  extra_turn: true,
});

// State after human moves a piece to outer track
const afterMoveState = makeLudoState({
  phase: "roll",
  die_value: null,
  valid_moves: [],
  player_states: [
    {
      player_id: "red",
      pieces: [
        { index: 0, position: 0, is_home: false, is_finished: false },
        { index: 1, position: -1, is_home: true, is_finished: false },
        { index: 2, position: -1, is_home: true, is_finished: false },
        { index: 3, position: -1, is_home: true, is_finished: false },
      ],
      pieces_home: 3,
      pieces_finished: 0,
    },
    {
      player_id: "yellow",
      pieces: [
        { index: 0, position: -1, is_home: true, is_finished: false },
        { index: 1, position: -1, is_home: true, is_finished: false },
        { index: 2, position: -1, is_home: true, is_finished: false },
        { index: 3, position: -1, is_home: true, is_finished: false },
      ],
      pieces_home: 4,
      pieces_finished: 0,
    },
  ],
});

async function setupLudoMocks(page: Page) {
  let callCount = 0;

  await page.route(`${API_BASE}/ludo/**`, async (route) => {
    const url = route.request().url();
    callCount++;

    if (url.endsWith("/ludo/new")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeLudoState()),
      });
    }

    if (url.endsWith("/ludo/state")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeLudoState()),
      });
    }

    if (url.endsWith("/ludo/roll")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rolledSixState),
      });
    }

    if (url.endsWith("/ludo/move")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(afterMoveState),
      });
    }

    if (url.endsWith("/ludo/new-game")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeLudoState()),
      });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Ludo — navigation and smoke tests", () => {
  test("navigates from Home to Ludo screen", async ({ page }) => {
    await setupLudoMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Play Ludo" }).click();

    await expect(page.getByRole("heading", { name: "Ludo" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Roll button is visible on Ludo screen (human's turn)", async ({ page }) => {
    await setupLudoMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Ludo" }).click();

    await expect(page.getByRole("button", { name: "Roll the die" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking Roll shows die value and piece selector", async ({ page }) => {
    await setupLudoMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Ludo" }).click();

    await page.getByRole("button", { name: "Roll the die" }).click();

    // After rolling 6, valid moves should appear
    await expect(page.getByRole("button", { name: /Move Piece 1/ })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("moving a piece updates the board state", async ({ page }) => {
    await setupLudoMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Ludo" }).click();

    // Roll the die
    await page.getByRole("button", { name: "Roll the die" }).click();

    // Click first movable piece
    await page.getByRole("button", { name: /Move Piece 1/ }).click();

    // After move, should show Roll button again (human's turn, roll phase)
    await expect(page.getByRole("button", { name: "Roll the die" })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("navigates back to Home from Ludo", async ({ page }) => {
    await setupLudoMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Ludo" }).click();

    await expect(page.getByRole("heading", { name: "Ludo" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /back/i }).click();

    await expect(page.getByText("Gaming App").first()).toBeVisible({ timeout: 5_000 });
  });
});
