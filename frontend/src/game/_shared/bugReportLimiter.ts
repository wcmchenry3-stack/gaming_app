/**
 * Per-source token bucket for reportBug (367b).
 *
 * Guardrail against a runaway caller that loops `reportBug(...)` in a
 * try/catch. Without this, a single buggy source could saturate the local
 * queue and then the sync worker. Rate is configurable via `logConfig`:
 *
 *   REPORT_BUG_MAX_PER_MINUTE_PER_SOURCE   refill rate (per source)
 *   REPORT_BUG_BURST_ALLOWANCE             bucket capacity (per source)
 *
 * State is in-memory only — intentional. Each process start gets a fresh
 * budget. Persisting would encourage treating the limiter as an escalation
 * mechanism instead of a safety valve.
 */

import { logConfig } from "./eventQueueConfig";

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

export class BugReportLimiter {
  private buckets: Map<string, Bucket> = new Map();

  /**
   * Try to consume one token from the `source` bucket. Returns true if
   * allowed, false if the bucket was empty. Lazy-refills based on wall
   * clock on every call.
   */
  tryConsume(source: string, now: number = Date.now()): boolean {
    const cap = logConfig.REPORT_BUG_BURST_ALLOWANCE;
    const refillPerMs = logConfig.REPORT_BUG_MAX_PER_MINUTE_PER_SOURCE / 60_000;

    let bucket = this.buckets.get(source);
    if (!bucket) {
      bucket = { tokens: cap, lastRefillAt: now };
      this.buckets.set(source, bucket);
    } else {
      const elapsed = Math.max(0, now - bucket.lastRefillAt);
      bucket.tokens = Math.min(cap, bucket.tokens + elapsed * refillPerMs);
      bucket.lastRefillAt = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Test helper. */
  reset(): void {
    this.buckets.clear();
  }
}

export const bugReportLimiter = new BugReportLimiter();
