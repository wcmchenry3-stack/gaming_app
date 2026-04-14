/**
 * #481 scenario 10 — Server unreachable, rows preserved across failures.
 *
 * The CRITICAL invariant for the stats/logs epic: a row is only deleted
 * from the local queue after a 2xx response from the server. This spec
 * scripts the first 5 POST /games/:id/events calls to return 500 and
 * asserts that row counts never drop during the failure window, then
 * lets the default (200) response drain the queue on the 6th flush.
 *
 * Wall-clock minimization: BACKOFF_BASE_MS is overridden to 1 ms so the
 * exponential backoff between failed flushes is measured in milliseconds,
 * not minutes. Production default (1 s base) is unchanged.
 */

import { test } from "@playwright/test";
import {
  clearLogstore,
  expect,
  inspectQueue,
  mockSyncEndpoints,
  resetLogConfig,
  triggerFlush,
  waitForLogstoreReady,
  withLogConfigOverride,
} from "./helpers/logstore";

test.describe("#481 scenario 10 — server unreachable", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForLogstoreReady(page);
    await resetLogConfig(page);
    await clearLogstore(page);
  });

  test("preserves all rows across 5 failed flushes, drains on recovery", async ({
    page,
  }) => {
    const mock = mockSyncEndpoints(page);
    await mock.install();

    await withLogConfigOverride(
      page,
      { BACKOFF_BASE_MS: 1, BACKOFF_MAX_MS: 50 },
      async () => {
        // Start a game so the pending-games store has a row. The real
        // SyncWorker pipeline requires this before events can flush.
        const gameId = await page.evaluate(() => {
          return (
            globalThis as unknown as {
              __gameEventClient_startGame: (t: string) => string;
            }
          ).__gameEventClient_startGame("yacht");
        });

        // Enqueue 49 events through the facade (so nextEventIndex stays
        // monotonic — seeding rows directly skips the PendingGamesStore
        // counter).
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
          { gameId, count: 49 },
        );

        // Close the game so the `/complete` step is exercised too.
        await page.evaluate((id: string) => {
          const g = globalThis as unknown as {
            __gameEventClient_completeGame: (
              id: string,
              s: {
                finalScore?: number | null;
                outcome?: string | null;
                durationMs?: number | null;
              },
            ) => void;
          };
          g.__gameEventClient_completeGame(id, {
            finalScore: 100,
            outcome: "completed",
            durationMs: 1000,
          });
        }, gameId);

        // 1 game_started + 49 roll + 1 game_ended = 51 rows queued.
        let stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(51);

        // Script 5 × 500 on POST /games/:id/events. /games creation falls
        // through to the default 200 so the pipeline can reach step 2.
        for (let i = 0; i < 5; i += 1) {
          mock.onNext(
            { method: "POST", pathRegex: /\/games\/[^/]+\/events$/ },
            { status: 500, body: { detail: "boom" } },
          );
        }

        // Five failed flush attempts. Row count must never drop — that's
        // the server-confirmed-deletion invariant. Between each, wait past
        // the current exponential backoff (base 1 ms, max 50 ms).
        for (let i = 0; i < 5; i += 1) {
          await triggerFlush(page);
          await page.waitForTimeout(60);
          stats = await inspectQueue(page);
          expect(stats.totalRows).toBe(51);
        }

        // Recovery flush: script exhausted, defaults (200) kick in. Events
        // drain, then completion drains. The second trigger picks up the
        // completion step if it queued behind the events flush.
        await page.waitForTimeout(60);
        await triggerFlush(page);
        await page.waitForTimeout(60);
        await triggerFlush(page);

        stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(0);
      },
    );
  });

  test("network abort (TypeError) is treated like 5xx — rows preserved", async ({
    page,
  }) => {
    // A flakier class of "server unreachable" — the request never reaches
    // the server at all (DNS failure, dropped connection, TLS error).
    // Playwright's `route.abort("failed")` simulates this.
    const mock = mockSyncEndpoints(page);
    await mock.install();

    await withLogConfigOverride(
      page,
      { BACKOFF_BASE_MS: 1, BACKOFF_MAX_MS: 50 },
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
          { gameId, count: 20 },
        );

        // Abort every POST /games/:id/events request for 3 flushes.
        for (let i = 0; i < 3; i += 1) {
          mock.onNext(
            { method: "POST", pathRegex: /\/games\/[^/]+\/events$/ },
            { status: 0, abort: true },
          );
        }

        const before = await inspectQueue(page);
        for (let i = 0; i < 3; i += 1) {
          await triggerFlush(page);
          await page.waitForTimeout(60);
          const stats = await inspectQueue(page);
          expect(stats.totalRows).toBe(before.totalRows);
        }
      },
    );
  });
});
