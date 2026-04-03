/**
 * Reusable API mock helpers for Yacht backend endpoints.
 *
 * The Yacht frontend calls http://localhost:8000 (EXPO_PUBLIC_API_URL default).
 * All helpers use page.route() to intercept these calls so tests are hermetic.
 */

import { Page, Route } from "@playwright/test";

const API_BASE = "http://localhost:8000";

export interface GameState {
  dice: number[];
  held: boolean[];
  rolls_used: number;
  round: number;
  scores: Record<string, number | null>;
  game_over: boolean;
  upper_subtotal: number;
  upper_bonus: number;
  total_score: number;
}

const CATEGORIES = [
  "ones", "twos", "threes", "fours", "fives", "sixes",
  "three_of_a_kind", "four_of_a_kind", "full_house",
  "small_straight", "large_straight", "yacht", "chance",
];

function blankState(round = 1): GameState {
  return {
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rolls_used: 0,
    round,
    scores: Object.fromEntries(CATEGORIES.map((c) => [c, null])),
    game_over: false,
    upper_subtotal: 0,
    upper_bonus: 0,
    total_score: 0,
  };
}

function rolledState(round = 1): GameState {
  return {
    ...blankState(round),
    dice: [1, 2, 3, 4, 5],
    rolls_used: 1,
  };
}

/**
 * Install a stateful full-game mock.
 * - POST /game/new          → fresh state round=1
 * - POST /game/roll         → state with dice + rolls_used=1
 * - GET  /game/possible-scores → all 13 categories with value 15
 * - POST /game/score        → advances round; game_over when round > 13
 */
export async function installYachtGameMock(page: Page): Promise<void> {
  let round = 1;
  const scored: Record<string, number> = {};

  await page.route(`${API_BASE}/game/new`, async (route: Route) => {
    round = 1;
    Object.keys(scored).forEach((k) => delete scored[k]);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(blankState(1)),
    });
  });

  await page.route(`${API_BASE}/game/roll`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rolledState(round)),
    });
  });

  await page.route(`${API_BASE}/game/possible-scores`, async (route: Route) => {
    const unfilled = CATEGORIES.filter((c) => !(c in scored));
    const possible = Object.fromEntries(unfilled.map((c) => [c, 15]));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ possible_scores: possible }),
    });
  });

  await page.route(`${API_BASE}/game/score`, async (route: Route) => {
    const body = JSON.parse((await route.request().postData()) ?? "{}");
    const cat: string = body.category ?? CATEGORIES[round - 1];
    scored[cat] = 15;

    round += 1;
    const isGameOver = round > 13;
    const allScores = Object.fromEntries(
      CATEGORIES.map((c) => [c, scored[c] ?? null]),
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...blankState(round),
        scores: allScores,
        game_over: isGameOver,
        total_score: Object.values(scored).reduce((a, b) => a + b, 0),
      }),
    });
  });
}

/**
 * Install a mock that returns a 503 for the first /game/new call,
 * then succeeds on subsequent calls.
 */
export async function installFlakyNewGameMock(page: Page): Promise<void> {
  let attempt = 0;

  await page.route(`${API_BASE}/game/new`, async (route: Route) => {
    attempt++;
    if (attempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Service unavailable" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(blankState(1)),
      });
    }
  });

  // Also install roll/score for after the retry succeeds
  await page.route(`${API_BASE}/game/roll`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rolledState(1)),
    });
  });

  await page.route(`${API_BASE}/game/possible-scores`, async (route: Route) => {
    const possible = Object.fromEntries(CATEGORIES.map((c) => [c, 15]));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ possible_scores: possible }),
    });
  });
}
