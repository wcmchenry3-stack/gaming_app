/**
 * Shared HTTP client factory for all game API clients.
 *
 * Every game's per-request logic (BASE_URL derivation, Sentry breadcrumbs,
 * X-Session-ID injection, error shaping) is identical apart from the
 * Sentry `tags.api` value. This factory collapses the 5 duplicated
 * `request<T>()` functions into one.
 *
 * Phase 1 of offline-play support (#131) uses this for the score queue's
 * cascade submissions. Migration of the 5 existing *Client.ts files to
 * this factory is tracked separately in #153.
 */

import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import { getOrCreateSessionId } from "./session";

function resolveBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

export interface HttpClientOptions {
  /** Sentry tag value, e.g. "cascade", "yacht". Used for per-game observability. */
  apiTag: string;
}

export function createGameClient(options: HttpClientOptions) {
  const { apiTag } = options;
  const BASE_URL = resolveBaseUrl();

  Sentry.addBreadcrumb({
    category: "api.config",
    message: `${apiTag} API: BASE_URL=${BASE_URL}, platform=${Platform.OS}`,
    level: "info",
  });

  return async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const method = options?.method ?? "GET";
    Sentry.addBreadcrumb({
      category: "api.request",
      message: `${method} ${url}`,
      level: "info",
    });
    try {
      const sessionId = await getOrCreateSessionId();
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
        ...options,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const msg = err.detail ?? "Request failed";
        Sentry.captureMessage(`API error: ${method} ${path} → ${res.status}`, {
          level: "warning",
          extra: { url, status: res.status, detail: msg, platform: Platform.OS },
        });
        throw new Error(msg);
      }
      return res.json();
    } catch (e) {
      if (e instanceof TypeError) {
        Sentry.captureException(e, {
          extra: { url, platform: Platform.OS, method },
          tags: { api: apiTag, errorType: "network" },
        });
      }
      throw e;
    }
  };
}
