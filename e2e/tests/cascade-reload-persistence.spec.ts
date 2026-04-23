/**
 * #216 — Cascade reload persistence.
 *
 * Plays a short Cascade session (a few drops, a merge or two via a
 * pinned RNG seed), then calls `page.reload()` and asserts:
 *
 *   - Score is preserved (non-zero after the reload).
 *   - Fruit count matches what was on the board before the reload
 *     (within a small tolerance for any fruit mid-merge at the moment
 *     of the save snapshot).
 *
 * Both assertions use the `__cascade_getState` test hook exposed by
 * CascadeScreen (gated on EXPO_PUBLIC_TEST_HOOKS=1).
 */

import { test, expect } from "@playwright/test";
import {
  gotoCascade,
  getState,
  setSeed,
  dropAt,
  spawnTierAt,
  fastForward,
  mockLeaderboard,
} from "./helpers/cascade";

test.describe("#216 — Cascade reload persistence", () => {
  test.beforeEach(async ({ page }) => {
    await mockLeaderboard(page);
    // Clear any stale storage from prior test runs sharing this
    // browser context.
    await page.goto("/");
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem("cascade_game_v1");
      } catch {
        /* ignore */
      }
    });
  });

  test("reload mid-game preserves score and the board of fruits", async ({
    page,
  }) => {
    await gotoCascade(page);
    await setSeed(page, 42);

    // Drop a handful of fruits in varied positions so the physics world
    // has meaningful state to snapshot.
    await dropAt(page, 120);
    await fastForward(page, 300);
    await dropAt(page, 200);
    await fastForward(page, 300);
    await dropAt(page, 160);
    await fastForward(page, 300);

    // Spawn two fruits of the same tier stacked near the same x to
    // trigger a merge, which is the #1 reload-persistence trigger in
    // CascadeScreen.handleMerge.
    await spawnTierAt(page, 2, 180);
    await fastForward(page, 100);
    await spawnTierAt(page, 2, 180);
    await fastForward(page, 600);

    // Give the throttled save a chance to land.
    await page.waitForTimeout(100);

    const before = await getState(page);
    expect(before.score).toBeGreaterThan(0);
    expect(before.fruits.length).toBeGreaterThan(0);
    const scoreBefore = before.score;
    const fruitCountBefore = before.fruits.length;

    // "Crash" — Playwright preserves localStorage (AsyncStorage
    // under the hood on web) across page.reload().
    await page.reload();
    await gotoCascade(page);

    // Give onReady + restoreFruits a frame to apply.
    await page.waitForTimeout(200);
    const after = await getState(page);

    expect(after.score).toBe(scoreBefore);
    // Fruit count tolerance: ±1 because of any fruit mid-merge at the
    // snapshot moment. The important assertion is "board is NOT empty".
    expect(after.fruits.length).toBeGreaterThanOrEqual(
      Math.max(1, fruitCountBefore - 1),
    );
  });

  test("starting a New Game after a reload restore yields a fresh board", async ({
    page,
  }) => {
    await gotoCascade(page);
    await setSeed(page, 7);
    // Force a couple of merges so score > 0 (the confirm modal only
    // appears when `scoreRef > 0 && !gameOver`).
    await spawnTierAt(page, 1, 150);
    await fastForward(page, 100);
    await spawnTierAt(page, 1, 150);
    await fastForward(page, 600);
    await spawnTierAt(page, 2, 200);
    await fastForward(page, 100);
    await spawnTierAt(page, 2, 200);
    await fastForward(page, 600);
    await page.waitForTimeout(100);

    await page.reload();
    await gotoCascade(page);
    await page.waitForTimeout(200);

    let state = await getState(page);
    expect(state.score).toBeGreaterThan(0);
    expect(state.fruits.length).toBeGreaterThan(0);

    // Open the ⋯ overflow menu, tap New Game, then confirm in the abandon dialog.
    await page.getByRole("button", { name: "More options" }).click();
    await page.getByText("New Game").click();
    await page.getByRole("button", { name: "Start New" }).click();

    await page.waitForTimeout(300);
    state = await getState(page);
    expect(state.score).toBe(0);
    expect(state.fruits.length).toBe(0);
  });
});
