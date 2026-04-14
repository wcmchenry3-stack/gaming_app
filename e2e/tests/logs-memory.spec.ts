/**
 * #482 scenario 3 — Memory budget.
 *
 * The epic's original ask: "10-minute stress session, total in-app
 * memory growth < 10 MB, no monotonic growth after sync."
 *
 * CI wall-clock compromise: this spec runs a ~30-second stress
 * session (4,000 enqueue + intermittent flush calls) with a scaled
 * 2 MB budget. A linear memory leak would still be visible within
 * that window — a leak of ≥ ~70 KB per 100 events would overshoot
 * the budget. The full 10-min session is a separate nightly spec
 * (not built in this PR; captured as a follow-up in the #482
 * description).
 *
 * Measurement caveat: desktop Chromium `performance.memory` is not
 * exposed reliably, so we use Playwright's `page.metrics().JSHeapUsedSize`
 * as the proxy. Mobile native-memory coverage is a separate gap —
 * would need an EAS device-lab run.
 *
 * Flake mitigation:
 *   - Warm up before baseline so module init and first-renders aren't
 *     counted against growth.
 *   - After each flush, rest briefly so GC can reclaim.
 *   - Assert a LOOSE upper bound — this test catches regressions, not
 *     fine-grained memory changes.
 */

import { test } from "@playwright/test";
import {
  clearLogstore,
  createMemorySampler,
  expect,
  inspectQueue,
  mockSyncEndpoints,
  resetLogConfig,
  triggerFlush,
  waitForLogstoreReady,
  withLogConfigOverride,
} from "./helpers/logstore";

const GROWTH_BUDGET_MB = 2;

test.describe("#482 scenario 3 — memory budget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForLogstoreReady(page);
    await resetLogConfig(page);
    await clearLogstore(page);
  });

  test("heap growth stays under the scaled budget across a 30s stress session", async ({
    page,
  }) => {
    const mock = mockSyncEndpoints(page);
    await mock.install();

    await withLogConfigOverride(
      page,
      { BACKOFF_BASE_MS: 1, BACKOFF_MAX_MS: 50 },
      async () => {
        // Warm up — mount effects, initial route render, i18n. Discard
        // any growth from this phase.
        await page.waitForTimeout(500);

        const sampler = createMemorySampler(page);
        const baseline = await sampler.baseline();

        // Drive events through several short-lived games so the worker
        // has something to flush between bursts. 80 × 50 = 4,000 events.
        for (let burst = 0; burst < 80; burst += 1) {
          await page.evaluate(
            async (args: { burst: number; count: number }) => {
              const g = globalThis as unknown as {
                __gameEventClient_startGame: (t: string) => string;
                __gameEventClient_enqueueEvent: (
                  id: string,
                  ev: { type: string; data?: Record<string, unknown> },
                ) => void;
                __gameEventClient_completeGame: (
                  id: string,
                  s: { finalScore?: number; outcome?: string },
                ) => void;
              };
              const gameId = g.__gameEventClient_startGame("yacht");
              for (let i = 0; i < args.count; i += 1) {
                g.__gameEventClient_enqueueEvent(gameId, {
                  type: "move",
                  data: { burst: args.burst, i },
                });
              }
              g.__gameEventClient_completeGame(gameId, {
                finalScore: 0,
                outcome: "completed",
              });
            },
            { burst, count: 50 },
          );

          // Every 10 bursts, let the worker drain so the queue doesn't
          // grow unbounded (which would dominate the heap metric).
          if (burst % 10 === 9) {
            await triggerFlush(page);
            await page.waitForTimeout(30);
          }
        }

        // Final drain — should empty the queue.
        for (let i = 0; i < 4; i += 1) {
          await triggerFlush(page);
          await page.waitForTimeout(30);
        }

        const queueAfter = await inspectQueue(page);
        expect(queueAfter.totalRows).toBe(0);

        // Sample after the drain. Give the browser a moment to settle.
        await page.waitForTimeout(200);
        const growth = await sampler.growthBytes();
        const growthMB = growth / (1024 * 1024);

        // Diagnostic for CI failure tracing.
        console.log(
          `[memory] baseline=${(baseline.jsHeapUsedBytes / (1024 * 1024)).toFixed(2)} MB, growth=${growthMB.toFixed(2)} MB (budget ${GROWTH_BUDGET_MB} MB)`,
        );

        expect(growthMB).toBeLessThanOrEqual(GROWTH_BUDGET_MB);
      },
    );
  });
});
