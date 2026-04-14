/**
 * #480 scenario 4 — Bounded queue eviction correctness.
 *
 * Seeds a 10,000-row fixture spanning all four priority tiers and asserts
 * that the eviction pass lands the queue at exactly MAX_ROWS (5,000) with
 * the expected survivors per the epic's priority policy:
 *
 *   P0 (100 bug logs)           → all preserved
 *   P1 (900 lifecycle)          → all preserved
 *   P2 (2,000 mid)              → all preserved
 *   P3 (7,000 granular)         → 2,000 newest survive, 5,000 oldest evicted
 *
 * Uses the #479 seed hooks so the fixture builds in one AsyncStorage
 * rewrite per tier, not per row.
 */

import { test } from "@playwright/test";
import {
  clearLogstore,
  expect,
  inspectQueue,
  resetLogConfig,
  seedEvictionFixture,
  waitForLogstoreReady,
} from "./helpers/logstore";

test.describe("#480 scenario 4 — bounded queue eviction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForLogstoreReady(page);
    await resetLogConfig(page);
    await clearLogstore(page);
  });

  test("seeds 10,000 rows across all tiers and evicts to MAX_ROWS with priority survivors", async ({
    page,
  }) => {
    // Epic policy: P3 (granular) evicted first; P2, P1, P0 preserved in
    // that order. Default MAX_ROWS = 5000, so the expected survivors are
    // 2,000 P3 + 2,000 P2 + 900 P1 + 100 P0 = 5,000.
    await seedEvictionFixture(page, {
      p3: 7000,
      p2: 2000,
      p1: 900,
      p0: 100,
    });

    const stats = await inspectQueue(page);
    expect(stats.totalRows).toBe(5000);

    // P0 bug logs: all preserved (nothing else to evict)
    expect(stats.byPriority[0]).toBe(100);
    // P1 lifecycle: all preserved
    expect(stats.byPriority[1]).toBe(900);
    // P2 mid: all preserved
    expect(stats.byPriority[2]).toBe(2000);
    // P3 granular: only the newest 2,000 survive
    expect(stats.byPriority[3]).toBe(2000);

    // Sanity check the log_type totals line up with the tiers.
    expect(stats.byLogType.bug_log).toBe(100);
    expect(stats.byLogType.game_event).toBe(4900);

    // Size cap should also be respected (well under the 5 MB default).
    expect(stats.sizeBytes).toBeLessThan(5 * 1024 * 1024);
  });

  test("subsequent events over-seeding P3 stay clamped at the cap", async ({
    page,
  }) => {
    // Sanity: seeding a full queue twice doesn't monotonically grow.
    await seedEvictionFixture(page, { p3: 6000 });
    let stats = await inspectQueue(page);
    expect(stats.totalRows).toBe(5000);

    await seedEvictionFixture(page, { p3: 1000 });
    stats = await inspectQueue(page);
    expect(stats.totalRows).toBe(5000);
  });
});
