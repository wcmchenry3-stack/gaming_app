import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import { getOrCreateSessionId } from "./client";

const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

Sentry.addBreadcrumb({
  category: "api.config",
  message: `Blackjack API: BASE_URL=${BASE_URL}, platform=${Platform.OS}`,
  level: "info",
});

export interface CardResponse {
  rank: string;
  suit: string;
  face_down: boolean;
}

export interface HandResponse {
  cards: CardResponse[];
  value: number;
}

export interface BlackjackState {
  phase: string; // "betting" | "player" | "result"
  chips: number;
  bet: number;
  player_hand: HandResponse;
  dealer_hand: HandResponse;
  outcome: string | null; // "blackjack" | "win" | "lose" | "push" | null
  payout: number;
  game_over: boolean;
  double_down_available: boolean;
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
        tags: { api: "blackjack", errorType: "network" },
      });
    }
    throw e;
  }
}

export const blackjackApi = {
  newSession: () => request<BlackjackState>("/blackjack/new", { method: "POST" }),

  getState: () => request<BlackjackState>("/blackjack/state"),

  placeBet: (amount: number) =>
    request<BlackjackState>("/blackjack/bet", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  hit: () => request<BlackjackState>("/blackjack/hit", { method: "POST" }),

  stand: () => request<BlackjackState>("/blackjack/stand", { method: "POST" }),

  doubleDown: () => request<BlackjackState>("/blackjack/double-down", { method: "POST" }),

  newHand: () => request<BlackjackState>("/blackjack/new-hand", { method: "POST" }),
};
