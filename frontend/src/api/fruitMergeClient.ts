import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import { getOrCreateSessionId } from "./client";

const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

Sentry.addBreadcrumb({
  category: "api.config",
  message: `FruitMerge API: BASE_URL=${BASE_URL}, platform=${Platform.OS}`,
  level: "info",
});

export interface ScoreEntry {
  player_name: string;
  score: number;
}

export interface LeaderboardResponse {
  scores: ScoreEntry[];
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
        tags: { api: "fruit-merge", errorType: "network" },
      });
    }
    throw e;
  }
}

export const fruitMergeApi = {
  submitScore: (player_name: string, score: number) =>
    request<ScoreEntry>("/fruit-merge/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score }),
    }),

  getLeaderboard: () => request<LeaderboardResponse>("/fruit-merge/scores"),
};
