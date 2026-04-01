import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";

const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
// Render's fromService can inject a bare subdomain slug (e.g. "yahtzee-api-fql1")
// without a protocol or the .onrender.com suffix. Normalise to a full URL.
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

Sentry.addBreadcrumb({
  category: "api.config",
  message: `Yahtzee API: BASE_URL=${BASE_URL}, raw=${_apiUrl}, platform=${Platform.OS}`,
  level: "info",
});

const SESSION_KEY = "game_session_id";

function generateUUID(): string {
  // crypto.randomUUID() is only available in browsers, not Hermes (React Native).
  // Fall back to a manual UUID v4 using Math.random().
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getOrCreateSessionId(): Promise<string> {
  let sid = await AsyncStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateUUID();
    await AsyncStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export interface GameState {
  dice: number[];
  held: boolean[];
  rolls_used: number;
  round: number;
  scores: Record<string, number | null>;
  game_over: boolean;
  upper_subtotal: number;
  upper_bonus: number;
  total_score: number;
}

export interface PossibleScores {
  possible_scores: Record<string, number>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const sessionId = await getOrCreateSessionId();
  const url = `${BASE_URL}${path}`;
  Sentry.addBreadcrumb({
    category: "api.request",
    message: `${options?.method ?? "GET"} ${url}`,
    level: "info",
  });
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Session-ID": sessionId,
      },
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
      // Network/fetch failures (e.g. DNS, timeout, ATS block)
      Sentry.captureException(e, {
        extra: { url, platform: Platform.OS, method: options?.method ?? "GET" },
        tags: { api: "yahtzee", errorType: "network" },
      });
    }
    throw e;
  }
}

export const api = {
  newGame: () => request<GameState>("/game/new", { method: "POST" }),

  getState: () => request<GameState>("/game/state"),

  roll: (held: boolean[]) =>
    request<GameState>("/game/roll", {
      method: "POST",
      body: JSON.stringify({ held }),
    }),

  score: (category: string) =>
    request<GameState>("/game/score", {
      method: "POST",
      body: JSON.stringify({ category }),
    }),

  possibleScores: () => request<PossibleScores>("/game/possible-scores"),
};
