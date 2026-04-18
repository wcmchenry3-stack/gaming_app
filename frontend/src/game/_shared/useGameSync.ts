/**
 * useGameSync — shared hook for game instrumentation lifecycle (#549).
 *
 * Encapsulates the gameEventClient session pattern that was previously
 * duplicated across GameScreen, Twenty48Screen, CascadeScreen, and
 * BlackjackGameContext:
 *   - gameIdRef / completedRef boilerplate
 *   - try/catch isolation on every client call
 *   - abandon-on-unmount cleanup
 *
 * Usage
 * -----
 *   const { start, enqueue, complete, restart, reportBug } = useGameSync("yacht");
 *
 *   // Begin a session (call once per game, e.g. after loading saved state)
 *   start({ initial_score: 0 });
 *
 *   // Record an event
 *   enqueue({ type: "roll", data: { dice: [1, 2, 3] } });
 *
 *   // Mark the session complete (prevents the unmount handler from firing)
 *   complete({ finalScore: 250, outcome: "completed" }, { final_score: 250 });
 *
 *   // End the current session as abandoned and immediately start a fresh one
 *   restart({ initial_score: 0 });
 *
 * The unmount cleanup automatically abandons any open session, so callers
 * only need to call complete() for game-over paths; abandoned paths are
 * handled for free.
 */

import { useCallback, useEffect, useRef } from "react";
import { gameEventClient, EnqueueEventInput } from "./gameEventClient";
import { CompleteSummary } from "./pendingGamesStore";
import type { GameType } from "./types";
import type { BugLevel } from "./eventQueueConfig";

export interface UseGameSyncReturn {
  /** Start a new instrumented session. Call once after the game state is ready. */
  start: (eventData?: Record<string, unknown>) => void;
  /** Enqueue a gameplay event. No-ops if no session is open. */
  enqueue: (event: EnqueueEventInput) => void;
  /**
   * Mark the session as complete. Prevents the unmount handler from firing
   * an abandoned event. Safe to call multiple times — only the first fires.
   */
  complete: (summary: CompleteSummary, payload?: Record<string, unknown>) => void;
  /**
   * End the current session (as abandoned if still open) and immediately
   * start a fresh one. Use this for New Game / theme-switch flows.
   */
  restart: (newEventData?: Record<string, unknown>) => void;
  /** Delegate to gameEventClient.reportBug with try/catch isolation. */
  reportBug: (
    level: BugLevel,
    source: string,
    message: string,
    context?: Record<string, unknown>
  ) => void;
}

export function useGameSync(gameType: GameType): UseGameSyncReturn {
  const gameIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  // Keep gameType in a ref so restart() always uses the current value even if
  // the consumer passes a runtime-derived type (shouldn't change, but safe).
  const gameTypeRef = useRef(gameType);
  useEffect(() => {
    gameTypeRef.current = gameType;
  }, [gameType]);

  // Abandon any open session on unmount.
  useEffect(() => {
    return () => {
      const gid = gameIdRef.current;
      if (gid && !completedRef.current) {
        try {
          gameEventClient.completeGame(gid, { outcome: "abandoned" }, { outcome: "abandoned" });
        } catch {
          // Isolation: never let cleanup throw.
        }
        gameIdRef.current = null;
      }
    };
  }, []);

  const start = useCallback((eventData?: Record<string, unknown>) => {
    gameIdRef.current = gameEventClient.startGame(gameTypeRef.current, {}, eventData ?? {});
    completedRef.current = false;
  }, []);

  const enqueue = useCallback((event: EnqueueEventInput) => {
    const gid = gameIdRef.current;
    if (!gid || completedRef.current) return;
    try {
      gameEventClient.enqueueEvent(gid, event);
    } catch {
      // Isolation.
    }
  }, []);

  const complete = useCallback((summary: CompleteSummary, payload?: Record<string, unknown>) => {
    const gid = gameIdRef.current;
    if (!gid || completedRef.current) return;
    try {
      gameEventClient.completeGame(gid, summary, payload ?? {});
    } catch {
      // Isolation.
    }
    completedRef.current = true;
    gameIdRef.current = null;
  }, []);

  const restart = useCallback((newEventData?: Record<string, unknown>) => {
    // Close the current session if still open.
    const gid = gameIdRef.current;
    if (gid && !completedRef.current) {
      try {
        gameEventClient.completeGame(gid, { outcome: "abandoned" }, { outcome: "abandoned" });
      } catch {
        // Isolation.
      }
    }
    // Open a fresh session.
    gameIdRef.current = gameEventClient.startGame(gameTypeRef.current, {}, newEventData ?? {});
    completedRef.current = false;
  }, []);

  const reportBug = useCallback(
    (level: BugLevel, source: string, message: string, context?: Record<string, unknown>) => {
      try {
        gameEventClient.reportBug(level, source, message, context);
      } catch {
        // Isolation.
      }
    },
    []
  );

  return { start, enqueue, complete, restart, reportBug };
}
