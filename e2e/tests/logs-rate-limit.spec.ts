/**
 * #481 scenario 11 — Rate-limit resilience.
 *
 * The epic-level ask is "429 with Retry-After is honored, worker doesn't
 * retry before the window, recovers after." Playwright 1.58.2's
 * `route.fulfill({ headers })` strips the Retry-After header before it
 * reaches the browser's fetch response (verified during #481 dev), so
 * asserting on the exact parsed window isn't possible at the e2e layer.
 *
 * Instead this spec exercises the same backoff behavior against a 5xx
 * response with `BACKOFF_BASE_MS` overridden to a known value (150 ms).
 * The exponential backoff path uses the same `backoffUntil` gate the
 * Retry-After path writes to, so asserting "flush during backoff is a
 * no-op" and "flush after backoff drains" covers the invariant.
 *
 * Retry-After header parsing has unit coverage in syncApi.test.ts.
 */

import { test } from "@playwright/test";
import {
  clearLogstore,
  expect,
  getBackoffUntil,
  inspectQueue,
  mockSyncEndpoints,
  resetLogConfig,
  triggerFlush,
  waitForLogstoreReady,
  withLogConfigOverride,
} from "./helpers/logstore";

test.describe("#481 scenario 11 — backoff respected across retry window", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForLogstoreReady(page);
    await resetLogConfig(page);
    await clearLogstore(page);
  });

  test("flush during backoff is a no-op; rows drain after the window", async ({
    page,
  }) => {
    const mock = mockSyncEndpoints(page);
    await mock.install();

    // Pin backoff to ~150 ms on the first failure: base 150, exponent → 1,
    // wait = 150 * 2^0 = 150. Max 250 keeps any subsequent retries bounded.
    await withLogConfigOverride(
      page,
      { BACKOFF_BASE_MS: 150, BACKOFF_MAX_MS: 250 },
      async () => {
        const gameId = await page.evaluate(() => {
          return (
            globalThis as unknown as {
              __gameEventClient_startGame: (t: string) => string;
            }
          ).__gameEventClient_startGame("yacht");
        });
        await page.evaluate(
          (args: { gameId: string; count: number }) => {
            const g = globalThis as unknown as {
              __gameEventClient_enqueueEvent: (
                id: string,
                ev: { type: string; data?: Record<string, unknown> },
              ) => void;
            };
            for (let i = 0; i < args.count; i += 1) {
              g.__gameEventClient_enqueueEvent(args.gameId, {
                type: "roll",
                data: { i },
              });
            }
          },
          { gameId, count: 9 },
        );

        // 1 game_started + 9 rolls = 10 rows.
        let stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(10);

        // First POST /games/:id/events returns 503. Subsequent requests
        // fall through to default 200 and drain.
        mock.onNext(
          { method: "POST", pathRegex: /\/games\/[^/]+\/events$/ },
          { status: 503, body: { detail: "busy" } },
        );

        const beforeFlush = Date.now();
        await triggerFlush(page);

        // Rows preserved after the 5xx.
        stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(10);

        // Backoff deadline lands ~beforeFlush + 150 ms (±100 ms slack for
        // flush wall-clock).
        const backoffAt = await getBackoffUntil(page);
        expect(backoffAt).toBeGreaterThanOrEqual(beforeFlush + 50);
        expect(backoffAt).toBeLessThanOrEqual(beforeFlush + 400);

        // A flush inside the backoff window is a no-op — row count stays
        // and the route sees no new request.
        const callsBefore = mock.calls.length;
        await triggerFlush(page);
        const callsDuringBackoff = mock.calls.length - callsBefore;
        expect(callsDuringBackoff).toBe(0);
        stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(10);

        // Wait past the window, then flush. The script is exhausted →
        // defaults (200) drain the queue.
        await page.waitForTimeout(500);
        await triggerFlush(page);
        await page.waitForTimeout(60);
        await triggerFlush(page);

        stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(0);
      },
    );
  });
});
