import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import { getOrCreateSessionId } from "./client";

const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}`;

Sentry.addBreadcrumb({
  category: "api.config",
  message: `2048 API: BASE_URL=${BASE_URL}, platform=${Platform.OS}`,
  level: "info",
});

export interface Twenty48State {
  board: number[][];
  score: number;
  game_over: boolean;
  has_won: boolean;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  Sentry.addBreadcrumb({
    category: "api.request",
    message: `${options?.method ?? "GET"} ${url}`,
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
      Sentry.captureMessage(`API error: ${options?.method ?? "GET"} ${path} → ${res.status}`, {
        level: "warning",
        extra: { url, status: res.status, detail: msg, platform: Platform.OS },
      });
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    if (e instanceof TypeError) {
      Sentry.captureException(e, {
        extra: { url, platform: Platform.OS, method: options?.method ?? "GET" },
        tags: { api: "twenty48", errorType: "network" },
      });
    }
    throw e;
  }
}

export const twenty48Api = {
  newSession: () => request<Twenty48State>("/twenty48/new", { method: "POST" }),

  getState: () => request<Twenty48State>("/twenty48/state"),

  move: (direction: string) =>
    request<Twenty48State>("/twenty48/move", {
      method: "POST",
      body: JSON.stringify({ direction }),
    }),
};
