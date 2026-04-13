/**
 * Low-level HTTP helper for the log-sync pipeline (367c).
 *
 * Unlike httpClient.createGameClient, this helper does NOT throw on
 * non-2xx. The SyncWorker state machine needs to inspect the status code
 * and Retry-After header to decide whether to delete, backoff, or
 * dead-letter rows. Throwing would lose that information.
 *
 * Fetch is injected so tests can drive every branch of the state machine
 * without touching the network.
 */

import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";

import { getOrCreateSessionId } from "./session";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SyncResponse {
  status: number;
  ok: boolean;
  retryAfterMs: number | null;
  body: unknown;
}

function resolveBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  if (!raw) return "http://localhost:8000";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function parseRetryAfter(headerValue: string | null, now: number): number | null {
  if (!headerValue) return null;
  const asInt = Number(headerValue);
  if (Number.isFinite(asInt)) return Math.max(0, asInt * 1000);
  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - now);
  return null;
}

export class SyncApi {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrlResolver: () => string = resolveBaseUrl
  ) {}

  async request(
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
    now: number = Date.now()
  ): Promise<SyncResponse> {
    const url = `${this.baseUrlResolver()}${path}`;
    let sessionId: string;
    try {
      sessionId = await getOrCreateSessionId();
    } catch {
      sessionId = "unknown";
    }
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify(body),
      });
      const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"), now);
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        parsed = null;
      }
      return {
        status: res.status,
        ok: res.ok,
        retryAfterMs,
        body: parsed,
      };
    } catch (e) {
      // Network failure — model as a synthetic 0 status so the state
      // machine treats it the same as 5xx (exponential backoff).
      Sentry.addBreadcrumb({
        category: "syncWorker.network",
        level: "warning",
        message: `${method} ${path} → network error: ${e instanceof Error ? e.message : String(e)}`,
        data: { platform: Platform.OS },
      });
      return { status: 0, ok: false, retryAfterMs: null, body: null };
    }
  }
}

export const syncApi = new SyncApi();
