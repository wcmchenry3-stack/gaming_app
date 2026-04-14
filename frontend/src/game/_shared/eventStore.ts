/**
 * Bounded local event queue for #367.
 *
 * Storage engine: AsyncStorage, sharded by priority tier. Each tier lives
 * under its own key so an enqueue only rewrites the affected tier — at
 * 5,000 rows across 4 tiers the largest rewrite is ~1 MB, not 5 MB.
 *
 *   event_queue_v1/tier/0   → bug logs (P0, preserved longest)
 *   event_queue_v1/tier/1   → lifecycle (P1)
 *   event_queue_v1/tier/2   → mid (P2)
 *   event_queue_v1/tier/3   → granular events (P3, evicted first)
 *   event_queue_v1/meta     → { warningLastShownAt }
 *
 * Eviction policy at cap: walk tiers from high to low (P3→P2→P1→P0),
 * drop oldest rows in each tier until the queue fits MAX_ROWS /
 * MAX_SIZE_BYTES. This preserves bug logs longest but doesn't starve the
 * queue if one source goes runaway.
 *
 * All operations are single-writer — the store itself is not concurrency-
 * safe within one JS runtime, but the FE is single-threaded so that's fine.
 * A mutex-free serial queue would be the upgrade path if that changes.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { LogType, Priority, logConfig } from "./eventQueueConfig";

const STORAGE_PREFIX = "event_queue_v1";
const META_KEY = `${STORAGE_PREFIX}/meta`;
const TIER_KEYS: Record<Priority, string> = {
  0: `${STORAGE_PREFIX}/tier/0`,
  1: `${STORAGE_PREFIX}/tier/1`,
  2: `${STORAGE_PREFIX}/tier/2`,
  3: `${STORAGE_PREFIX}/tier/3`,
};
const TIERS: Priority[] = [0, 1, 2, 3];

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface GameEventRow {
  id: string;
  log_type: "game_event";
  game_id: string;
  event_index: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: number;
  priority: Priority;
  retry_count: number;
  next_retry_at: number | null;
  /** Set by SyncWorker on terminal failure (400, 403, repeated 413 on a
   *  single row, etc). Dead-lettered rows are skipped by peek() but still
   *  consume queue slots, so they age out via priority eviction or TTL. */
  dead_lettered?: boolean;
}

export interface BugLogRow {
  id: string;
  log_type: "bug_log";
  bug_uuid: string;
  bug_level: "warn" | "error" | "fatal";
  bug_source: string;
  payload: Record<string, unknown>;
  created_at: number;
  priority: Priority;
  retry_count: number;
  next_retry_at: number | null;
  dead_lettered?: boolean;
}

export type Row = GameEventRow | BugLogRow;

interface MetaState {
  warningLastShownAt: number | null;
}

export interface QueueStats {
  totalRows: number;
  sizeBytes: number;
  byLogType: Record<LogType, number>;
  byPriority: Record<Priority, number>;
  oldestAt: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: same pattern as scoreQueue.generateUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function rowBytes(row: Row): number {
  // Approximate — JSON.stringify length is UTF-16 char count, and we treat
  // it as a size proxy. For ASCII payloads this matches byte count; for
  // non-ASCII it slightly under-counts, which is fine for a soft cap.
  return JSON.stringify(row).length;
}

// ---------------------------------------------------------------------------
// EventStore
// ---------------------------------------------------------------------------

export class EventStore {
  // Prevent interleaved enqueue/evict from reading stale tiers. All mutators
  // go through withLock.
  private lock: Promise<unknown> = Promise.resolve();

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.lock.then(fn, fn);
    // Swallow errors for the lock chain — caller still sees the rejection.
    this.lock = next.catch(() => undefined);
    return next;
  }

  // -------------------------------------------------------------------------
  // Internal read/write helpers (per-tier)
  // -------------------------------------------------------------------------

  private async readTier(tier: Priority): Promise<Row[]> {
    const raw = await AsyncStorage.getItem(TIER_KEYS[tier]);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as Row[]) : [];
    } catch {
      // Corrupted tier — drop it. Better to lose that tier than to fail
      // every future write.
      await AsyncStorage.removeItem(TIER_KEYS[tier]);
      return [];
    }
  }

  private async writeTier(tier: Priority, rows: Row[]): Promise<void> {
    if (rows.length === 0) {
      await AsyncStorage.removeItem(TIER_KEYS[tier]);
      return;
    }
    await AsyncStorage.setItem(TIER_KEYS[tier], JSON.stringify(rows));
  }

  private async readMeta(): Promise<MetaState> {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { warningLastShownAt: null };
    try {
      return JSON.parse(raw) as MetaState;
    } catch {
      return { warningLastShownAt: null };
    }
  }

  private async writeMeta(meta: MetaState): Promise<void> {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async enqueueEvent(input: {
    game_id: string;
    event_index: number;
    event_type: string;
    payload: Record<string, unknown>;
  }): Promise<GameEventRow> {
    return this.withLock(async () => {
      const priority = logConfig.priorityForEvent("game_event", input.event_type);
      const row: GameEventRow = {
        id: generateId(),
        log_type: "game_event",
        game_id: input.game_id,
        event_index: input.event_index,
        event_type: input.event_type,
        payload: this.truncatePayload(input.payload, logConfig.MAX_EVENT_PAYLOAD_BYTES),
        created_at: Date.now(),
        priority,
        retry_count: 0,
        next_retry_at: null,
      };
      const tier = await this.readTier(priority);
      tier.push(row);
      await this.writeTier(priority, tier);
      await this.evictToCapacityUnlocked();
      return row;
    });
  }

  async enqueueBugLog(input: {
    bug_uuid: string;
    bug_level: "warn" | "error" | "fatal";
    bug_source: string;
    payload: Record<string, unknown>;
  }): Promise<BugLogRow> {
    return this.withLock(async () => {
      const row: BugLogRow = {
        id: generateId(),
        log_type: "bug_log",
        bug_uuid: input.bug_uuid,
        bug_level: input.bug_level,
        bug_source: input.bug_source,
        payload: this.truncatePayload(input.payload, logConfig.MAX_BUG_CONTEXT_BYTES),
        created_at: Date.now(),
        priority: Priority.BUG_LOG,
        retry_count: 0,
        next_retry_at: null,
      };
      const tier = await this.readTier(Priority.BUG_LOG);
      tier.push(row);
      await this.writeTier(Priority.BUG_LOG, tier);
      await this.evictToCapacityUnlocked();
      return row;
    });
  }

  /**
   * Peek the N oldest rows across tiers, ordered by (priority desc,
   * created_at asc). SyncWorker uses this to build batches. Deleted rows
   * are the caller's responsibility — we don't mark peeked rows in any way.
   *
   * Dead-lettered rows are skipped unless `includeDeadLettered` is set.
   * Rows with a future `next_retry_at` (set by backoff) are also skipped
   * unless `now` is explicitly advanced past them.
   */
  async peek(
    limit: number,
    opts: { includeDeadLettered?: boolean; includeFuture?: boolean; now?: number } = {}
  ): Promise<Row[]> {
    const now = opts.now ?? Date.now();
    return this.withLock(async () => {
      const out: Row[] = [];
      for (const tier of [Priority.LIFECYCLE, Priority.MID, Priority.GRANULAR, Priority.BUG_LOG]) {
        const rows = (await this.readTier(tier)).slice();
        rows.sort((a, b) => a.created_at - b.created_at);
        for (const row of rows) {
          if (!opts.includeDeadLettered && row.dead_lettered) continue;
          if (!opts.includeFuture && row.next_retry_at !== null && row.next_retry_at > now) {
            continue;
          }
          out.push(row);
          if (out.length >= limit) return out;
        }
      }
      return out;
    });
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.withLock(async () => {
      const set = new Set(ids);
      let removed = 0;
      for (const tier of TIERS) {
        const rows = await this.readTier(tier);
        const kept = rows.filter((r) => !set.has(r.id));
        removed += rows.length - kept.length;
        if (kept.length !== rows.length) {
          await this.writeTier(tier, kept);
        }
      }
      return removed;
    });
  }

  /**
   * Update a batch of rows (e.g. after a 429 sets next_retry_at on them).
   * Rows are matched by id; missing rows are silently ignored.
   */
  async updateRows(updated: Row[]): Promise<void> {
    if (updated.length === 0) return;
    return this.withLock(async () => {
      const byId = new Map(updated.map((r) => [r.id, r]));
      for (const tier of TIERS) {
        const rows = await this.readTier(tier);
        let mutated = false;
        for (let i = 0; i < rows.length; i += 1) {
          const replacement = byId.get(rows[i].id);
          if (replacement) {
            rows[i] = replacement;
            mutated = true;
          }
        }
        if (mutated) await this.writeTier(tier, rows);
      }
    });
  }

  async sweepTTL(now: number = Date.now()): Promise<number> {
    return this.withLock(async () => {
      const cutoff = now - logConfig.TTL_MS;
      let removed = 0;
      for (const tier of TIERS) {
        const rows = await this.readTier(tier);
        const kept = rows.filter((r) => r.created_at >= cutoff);
        removed += rows.length - kept.length;
        if (kept.length !== rows.length) {
          await this.writeTier(tier, kept);
        }
      }
      return removed;
    });
  }

  async stats(): Promise<QueueStats> {
    return this.withLock(async () => this.statsUnlocked());
  }

  async clearAll(): Promise<void> {
    return this.withLock(async () => {
      for (const tier of TIERS) await AsyncStorage.removeItem(TIER_KEYS[tier]);
      await AsyncStorage.removeItem(META_KEY);
    });
  }

  /**
   * Test-only: bulk-insert raw rows into the appropriate tiers and run a
   * single eviction pass. Used by the #373 e2e harness to build large
   * fixtures cheaply — a normal enqueue path would re-enter the lock once
   * per row, and 10,000 rows times N ms of AsyncStorage write is infeasible.
   * Public on the class because the test-only gate lives at the window hook
   * layer, not here.
   */
  async seedRows(rows: Row[]): Promise<void> {
    if (rows.length === 0) return;
    return this.withLock(async () => {
      const byTier: Record<Priority, Row[]> = { 0: [], 1: [], 2: [], 3: [] };
      for (const row of rows) byTier[row.priority].push(row);
      for (const tier of TIERS) {
        if (byTier[tier].length === 0) continue;
        const existing = await this.readTier(tier);
        await this.writeTier(tier, existing.concat(byTier[tier]));
      }
      await this.evictToCapacityUnlocked();
    });
  }

  /** Capacity warning state (read/updated by gameEventClient). */
  async shouldShowCapacityWarning(stats?: QueueStats, now: number = Date.now()): Promise<boolean> {
    return this.withLock(async () => {
      const s = stats ?? (await this.statsUnlocked());
      const ratio = Math.max(
        s.totalRows / logConfig.MAX_ROWS,
        s.sizeBytes / logConfig.MAX_SIZE_BYTES
      );
      if (ratio < logConfig.CAPACITY_WARNING_RATIO) return false;
      const meta = await this.readMeta();
      if (
        meta.warningLastShownAt !== null &&
        now - meta.warningLastShownAt < logConfig.CAPACITY_WARNING_SUPPRESS_MS
      ) {
        return false;
      }
      return true;
    });
  }

  async markWarningShown(now: number = Date.now()): Promise<void> {
    return this.withLock(async () => {
      await this.writeMeta({ warningLastShownAt: now });
    });
  }

  // -------------------------------------------------------------------------
  // Internal capacity enforcement
  // -------------------------------------------------------------------------

  /**
   * Public, lock-free entry point for tests and scenarios where the caller
   * already holds the lock. Callers outside the class should prefer
   * evictToCapacity().
   */
  async evictToCapacity(): Promise<number> {
    return this.withLock(async () => this.evictToCapacityUnlocked());
  }

  private async evictToCapacityUnlocked(): Promise<number> {
    // Batched eviction: compute the overage once, then walk tiers from
    // highest priority (P3 granular, evicted first) down to P0 (bug logs,
    // preserved longest), dropping as many oldest rows per tier as the
    // remaining overage requires. This is a single read+write per tier
    // instead of one per evicted row — the per-row loop was O(overage × n)
    // on AsyncStorage, which blew up test fixtures that seeded 10k rows.
    const stats = await this.statsUnlocked();
    let overageRows = stats.totalRows - logConfig.MAX_ROWS;
    let overageBytes = stats.sizeBytes - logConfig.MAX_SIZE_BYTES;
    if (overageRows <= 0 && overageBytes <= 0) return 0;

    let totalEvicted = 0;
    for (let pri = 3; pri >= 0; pri -= 1) {
      if (overageRows <= 0 && overageBytes <= 0) break;
      const tierRows = await this.readTier(pri as Priority);
      if (tierRows.length === 0) continue;
      tierRows.sort((a, b) => a.created_at - b.created_at);

      let drop = 0;
      while (drop < tierRows.length && (overageRows > 0 || overageBytes > 0)) {
        overageBytes -= rowBytes(tierRows[drop]);
        overageRows -= 1;
        drop += 1;
      }
      if (drop > 0) {
        await this.writeTier(pri as Priority, tierRows.slice(drop));
        totalEvicted += drop;
      }
    }
    return totalEvicted;
  }

  private async statsUnlocked(): Promise<QueueStats> {
    const byPriority: Record<Priority, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const byLogType: Record<LogType, number> = { game_event: 0, bug_log: 0 };
    let totalRows = 0;
    let sizeBytes = 0;
    let oldestAt: number | null = null;

    for (const tier of TIERS) {
      const rows = await this.readTier(tier);
      byPriority[tier] += rows.length;
      totalRows += rows.length;
      for (const row of rows) {
        byLogType[row.log_type] += 1;
        sizeBytes += rowBytes(row);
        if (oldestAt === null || row.created_at < oldestAt) {
          oldestAt = row.created_at;
        }
      }
    }
    return { totalRows, sizeBytes, byLogType, byPriority, oldestAt };
  }

  private truncatePayload(
    payload: Record<string, unknown>,
    maxBytes: number
  ): Record<string, unknown> {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= maxBytes) return payload;
    // Oversized — replace with a stub. This preserves the enqueue contract
    // (payload is always an object) while preventing a single runaway row
    // from blowing the queue.
    return {
      _truncated: true,
      _original_bytes: serialized.length,
    };
  }
}

export const eventStore = new EventStore();
