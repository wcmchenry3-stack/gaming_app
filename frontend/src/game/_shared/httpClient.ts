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

/** Error subclass that preserves the HTTP status code from the API response. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Resolves the base URL for API calls.
 *
 * `EXPO_PUBLIC_*` variables are inlined into the bundle by Expo's web/native
 * exporter at build time, so the value must be present when `npx expo export`
 * runs — not at runtime. If we ship a non-dev bundle without it, every
 * request will hit `http://localhost:8000` and fail with a `TypeError:
 * Failed to fetch`, which is exactly what #511 documented.
 *
 * Rather than silently fall back (and then have Sentry record a flood of
 * confusing per-request fetch errors), we throw at module load. That makes
 * the misconfiguration impossible to miss: the app fails fast on boot with
 * a clear message instead of pretending to work and then breaking on every
 * score submit.
 */
function resolveBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  if (raw) {
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  if (__DEV__) {
    return "http://localhost:8000";
  }
  const msg =
    "EXPO_PUBLIC_API_URL is not set in a non-dev build. " +
    "Expo bakes EXPO_PUBLIC_* vars into the bundle at export time, so this " +
    "must be present when `expo export` runs — set it on the Render service " +
    "(see render.yaml) or in the build environment. Refusing to fall back to " +
    "http://localhost:8000.";
  Sentry.captureMessage(msg, {
    level: "fatal",
    tags: { subsystem: "httpClient", issue: "missing-env" },
  });
  throw new Error(msg);
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
        throw new ApiError(msg, res.status);
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
