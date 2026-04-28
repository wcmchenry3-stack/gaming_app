/**
 * Public facade for game event + bug log logging (367b).
 *
 * Goals:
 *   1. Never block gameplay — startGame returns the id synchronously;
 *      all other mutators return void and persist asynchronously.
 *   2. Monotonic, gap-free event_index per game — tracked in the
 *      in-memory PendingGamesStore. SyncWorker relies on this when
 *      sending POST /games/:id/events.
 *   3. Runaway caller protection — reportBug is gated by a per-source
 *      token bucket before anything touches the queue.
 *
 * Errors in the fire-and-forget persistence path go to Sentry, not
 * back to the caller (the caller long forgot about the call).
 */

import * as Sentry from "@sentry/react-native";

import { eventStore, EventStore, QueueStats } from "./eventStore";
import { bugReportLimiter, BugReportLimiter } from "./bugReportLimiter";
import { BugLevel } from "./eventQueueConfig";
import { pendingGamesStore, PendingGamesStore, CompleteSummary } from "./pendingGamesStore";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; // codeql[js/insecure-randomness]
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface EnqueueEventInput {
  type: string;
  data?: Record<string, unknown>;
}

export interface GameEventClient {
  init(): Promise<void>;
  startGame(
    gameType: string,
    metadata?: Record<string, unknown>,
    eventData?: Record<string, unknown>
  ): string;
  enqueueEvent(gameId: string, event: EnqueueEventInput): void;
  completeGame(gameId: string, summary: CompleteSummary, eventData?: Record<string, unknown>): void;
  reportBug(
    level: BugLevel,
    source: string,
    message: string,
    context?: Record<string, unknown>
  ): void;
  getQueueStats(): Promise<QueueStats>;
  clearAll(): Promise<void>;
}

export class GameEventClientImpl implements GameEventClient {
  constructor(
    private readonly store: EventStore = eventStore,
    private readonly games: PendingGamesStore = pendingGamesStore,
    private readonly limiter: BugReportLimiter = bugReportLimiter
  ) {}

  async init(): Promise<void> {
    await this.games.init();
  }

  /** Returns the new game id synchronously. */
  startGame(
    gameType: string,
    metadata: Record<string, unknown> = {},
    eventData?: Record<string, unknown>
  ): string {
    const gameId = generateUUID();
    // Persist pending-game state synchronously in-memory, async to disk.
    // The event below grabs event_index 0 and we rely on the in-memory
    // counter being correct the moment startGame returns.
    this.fireAndForget(this.games.create(gameId, gameType, metadata), "startGame.create");
    // Reserve event_index 0 for a game_started event so the SyncWorker
    // can tell when a game was opened even before any play happened.
    this.enqueueEventInternal(gameId, {
      type: "game_started",
      data: eventData ?? { game_type: gameType, metadata },
    });
    return gameId;
  }

  enqueueEvent(gameId: string, event: EnqueueEventInput): void {
    this.enqueueEventInternal(gameId, event);
  }

  completeGame(
    gameId: string,
    summary: CompleteSummary,
    eventData?: Record<string, unknown>
  ): void {
    this.enqueueEventInternal(gameId, {
      type: "game_ended",
      data: eventData ?? (summary as Record<string, unknown>),
    });
    this.fireAndForget(this.games.complete(gameId, summary), "completeGame.mark");
  }

  reportBug(
    level: BugLevel,
    source: string,
    message: string,
    context: Record<string, unknown> = {}
  ): void {
    if (!this.limiter.tryConsume(source)) {
      // Dropped — emit a Sentry counter so we can see runaway sources.
      Sentry.addBreadcrumb({
        category: "reportBug.dropped",
        message: `rate-limited: ${source}`,
        level: "warning",
      });
      return;
    }
    const bugUuid = generateUUID();
    this.fireAndForget(
      this.store.enqueueBugLog({
        bug_uuid: bugUuid,
        bug_level: level,
        bug_source: source,
        payload: { message, context },
      }),
      "reportBug.enqueue"
    );
  }

  getQueueStats(): Promise<QueueStats> {
    return this.store.stats();
  }

  async clearAll(): Promise<void> {
    await this.store.clearAll();
    await this.games.clearAll();
    this.limiter.reset();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private enqueueEventInternal(gameId: string, event: EnqueueEventInput): void {
    const idx = this.games.nextEventIndex(gameId);
    if (idx === null) {
      // Game not registered (or already completed) — treat as a drop and
      // breadcrumb for visibility. Not a bug log; bug logs are reserved for
      // caller-reported issues.
      Sentry.addBreadcrumb({
        category: "gameEventClient.dropped",
        message: `enqueueEvent on unknown game ${gameId}`,
        level: "warning",
      });
      return;
    }
    this.fireAndForget(
      this.store.enqueueEvent({
        game_id: gameId,
        event_index: idx,
        event_type: event.type,
        payload: event.data ?? {},
      }),
      "enqueueEvent"
    );
  }

  private fireAndForget(op: Promise<unknown>, label: string): void {
    op.catch((e) => {
      Sentry.captureException(e, {
        tags: { subsystem: "gameEventClient", op: label },
      });
    });
  }
}

export const gameEventClient: GameEventClient = new GameEventClientImpl();
