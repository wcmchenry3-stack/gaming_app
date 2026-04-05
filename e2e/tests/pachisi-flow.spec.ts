/**
 * pachisi-flow.spec.ts
 *
 * E2E smoke test for the Pachisi game.
 * All /pachisi/* API calls are mocked — no live backend required.
 */

import { test, expect, Page } from "@playwright/test";

const API_BASE = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Mock state factory
// ---------------------------------------------------------------------------

function makePachisiState(overrides: Record<string, unknown> = {}) {
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
const rolledSixState = makePachisiState({
  phase: "move",
  die_value: 6,
  valid_moves: [0, 1, 2, 3],
  extra_turn: true,
});

// State after human moves a piece to outer track
const afterMoveState = makePachisiState({
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

async function setupPachisiMocks(page: Page) {
  let callCount = 0;

  await page.route(`${API_BASE}/pachisi/**`, async (route) => {
    const url = route.request().url();
    callCount++;

    if (url.endsWith("/pachisi/new")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makePachisiState()),
      });
    }

    if (url.endsWith("/pachisi/state")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makePachisiState()),
      });
    }

    if (url.endsWith("/pachisi/roll")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rolledSixState),
      });
    }

    if (url.endsWith("/pachisi/move")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(afterMoveState),
      });
    }

    if (url.endsWith("/pachisi/new-game")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makePachisiState()),
      });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Pachisi — navigation and smoke tests", () => {
  test("navigates from Home to Pachisi screen", async ({ page }) => {
    await setupPachisiMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Play Pachisi" }).click();

    await expect(page.getByRole("heading", { name: "Pachisi" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Roll button is visible on Pachisi screen (human's turn)", async ({ page }) => {
    await setupPachisiMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Pachisi" }).click();

    await expect(page.getByRole("button", { name: "Roll the die" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking Roll shows die value and piece selector", async ({ page }) => {
    await setupPachisiMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Pachisi" }).click();

    await page.getByRole("button", { name: "Roll the die" }).click();

    // After rolling 6, valid moves should appear
    await expect(page.getByRole("button", { name: /Move Piece 1/ })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("moving a piece updates the board state", async ({ page }) => {
    await setupPachisiMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Pachisi" }).click();

    // Roll the die
    await page.getByRole("button", { name: "Roll the die" }).click();

    // Click first movable piece
    await page.getByRole("button", { name: /Move Piece 1/ }).click();

    // After move, should show Roll button again (human's turn, roll phase)
    await expect(page.getByRole("button", { name: "Roll the die" })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("navigates back to Home from Pachisi", async ({ page }) => {
    await setupPachisiMocks(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Play Pachisi" }).click();

    await expect(page.getByRole("heading", { name: "Pachisi" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /back/i }).click();

    await expect(page.getByText("Gaming App").first()).toBeVisible({ timeout: 5_000 });
  });
});
