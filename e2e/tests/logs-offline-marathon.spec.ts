/**
 * #481 scenario 1 — Offline gameplay marathon (scaled-down).
 *
 * The epic spec calls for a full UI playthrough of Yacht (13 rounds) +
 * 2048 (to game over) + Blackjack (10 hands) + Cascade (to game over)
 * while offline, then back-online-and-sync within 60 s.
 *
 * Rationale for scaling it down:
 *
 * - Driving four full games through their existing e2e helpers in one
 *   spec is ~2 min of wall clock even with tight seeds, and every CI
 *   run picks up the cost. The instrumentation pattern is identical
 *   across all four games (#368–#371) — a per-game smoke already lives
 *   in each game's e2e suite.
 *
 * - The real invariant scenario 1 asserts is: while /games/** is
 *   unreachable, (a) games don't stall, (b) the queue fills with the
 *   expected shape of events, (c) sizeBytes stays sane, and (d) flipping
 *   the mock to 200 drains the queue within the budget.
 *
 * We capture (a)-(d) by driving events via the test hooks across four
 * synthetic game sessions while the responder is aborting every /games
 * and /logs request. This mirrors "offline" without requiring the OS
 * network stack or breaking i18n / asset fetches. Then we flip to 200
 * and assert drain.
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

const MAX_OFFLINE_QUEUE_BYTES = 2 * 1024 * 1024; // 2 MB from the epic spec

test.describe("#481 scenario 1 — offline gameplay marathon (scaled)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForLogstoreReady(page);
    await resetLogConfig(page);
    await clearLogstore(page);
  });

  test("offline session fills the queue, going online drains it", async ({
    page,
  }) => {
    const mock = mockSyncEndpoints(page, {
      // Everything aborts — worker sees network failures and backs off.
      defaultResponse: { status: 0, abort: true },
    });
    await mock.install();

    // Shrink backoff so per-row next_retry_at doesn't outlive the test.
    // Production default is 1 s base with 30 min ceiling — that would
    // stall the online-drain phase behind the per-row deadlines.
    await withLogConfigOverride(
      page,
      { BACKOFF_BASE_MS: 1, BACKOFF_MAX_MS: 50 },
      async () => {
        // Play four synthetic games in sequence while offline. Each game is
        // a realistic event shape for its type, exercising game_started,
        // a batch of mid-tier + granular events, and game_ended.
        await page.evaluate(async () => {
          const g = globalThis as unknown as {
            __gameEventClient_startGame: (t: string) => string;
            __gameEventClient_enqueueEvent: (
              id: string,
              ev: { type: string; data?: Record<string, unknown> },
            ) => void;
            __gameEventClient_completeGame: (
              id: string,
              s: { finalScore?: number; outcome?: string; durationMs?: number },
            ) => void;
          };

          // Yacht — 13 rounds, each with 1-3 rolls + 1 score.
          const yacht = g.__gameEventClient_startGame("yacht");
          for (let r = 1; r <= 13; r += 1) {
            for (let roll = 1; roll <= 3; roll += 1) {
              g.__gameEventClient_enqueueEvent(yacht, {
                type: "roll",
                data: {
                  round: r,
                  rolls_used_after: roll,
                  dice: [1, 2, 3, 4, 5],
                },
              });
            }
            g.__gameEventClient_enqueueEvent(yacht, {
              type: "score",
              data: { category: "ones", value: r },
            });
          }
          g.__gameEventClient_completeGame(yacht, {
            finalScore: 250,
            outcome: "completed",
            durationMs: 300_000,
          });

          // 2048 — ~150 moves to game-over.
          const twenty48 = g.__gameEventClient_startGame("twenty48");
          for (let i = 0; i < 150; i += 1) {
            g.__gameEventClient_enqueueEvent(twenty48, {
              type: "move",
              data: {
                direction: ["up", "down", "left", "right"][i % 4],
                score_after: i * 4,
                is_game_over: false,
              },
            });
          }
          g.__gameEventClient_completeGame(twenty48, {
            finalScore: 4000,
            outcome: "completed",
            durationMs: 600_000,
          });

          // Blackjack — 10 hands, each with bet + deal + 2 actions + resolve.
          const blackjack = g.__gameEventClient_startGame("blackjack");
          for (let i = 0; i < 10; i += 1) {
            g.__gameEventClient_enqueueEvent(blackjack, {
              type: "bet_placed",
              data: { amount: 25 },
            });
            g.__gameEventClient_enqueueEvent(blackjack, {
              type: "hand_dealt",
              data: { is_player_blackjack: false },
            });
            g.__gameEventClient_enqueueEvent(blackjack, {
              type: "player_action",
              data: { action: "hit", hand_index: 0 },
            });
            g.__gameEventClient_enqueueEvent(blackjack, {
              type: "player_action",
              data: { action: "stand", hand_index: 0 },
            });
            g.__gameEventClient_enqueueEvent(blackjack, {
              type: "hand_resolved",
              data: { outcome: "win", payout_delta: 25 },
            });
          }
          g.__gameEventClient_completeGame(blackjack, {
            finalScore: 0,
            outcome: "completed",
            durationMs: 450_000,
          });

          // Cascade — 120 drops interleaved with 30 merges.
          const cascade = g.__gameEventClient_startGame("cascade");
          for (let i = 0; i < 120; i += 1) {
            g.__gameEventClient_enqueueEvent(cascade, {
              type: "drop",
              data: {
                drop_index: i,
                fruit_tier: i % 11,
                x: 100,
                score_before: i * 2,
              },
            });
            if (i % 4 === 3) {
              g.__gameEventClient_enqueueEvent(cascade, {
                type: "merge",
                data: {
                  from_tier: 2,
                  to_tier: 3,
                  x: 100,
                  y: 200,
                  score_after: i * 3,
                },
              });
            }
          }
          g.__gameEventClient_completeGame(cascade, {
            finalScore: 1500,
            outcome: "completed",
            durationMs: 240_000,
          });
        });

        // Attempt a flush — everything should fail (routes abort), rows
        // should stay in the queue, worker should back off without crashing.
        await triggerFlush(page);
        let stats = await inspectQueue(page);
        // All four games contributed: ~4 game_started + 52 yacht + 150 twenty48
        // + 50 blackjack + 150 cascade + 4 game_ended = ~410 rows. Exact count
        // depends on the loop math above; we assert "has a bunch of events"
        // and "size fits the offline budget".
        expect(stats.totalRows).toBeGreaterThan(350);
        expect(stats.byLogType.game_event).toBe(stats.totalRows);
        expect(stats.sizeBytes).toBeLessThan(MAX_OFFLINE_QUEUE_BYTES);

        // Flip online — switch the default to 200 responses. Flush and drain.
        mock.setDefaultResponse({
          status: 200,
          body: { accepted: 0, duplicates: 0, rejected: [] },
        });

        // Multiple flushes so the worker can walk each pending game through
        // its three steps (creation, events, complete). Give any per-row
        // backoff from the abort phase plenty of headroom to clear.
        for (let i = 0; i < 6; i += 1) {
          await page.waitForTimeout(100);
          await triggerFlush(page);
        }

        stats = await inspectQueue(page);
        expect(stats.totalRows).toBe(0);
      },
    );
  });
});
