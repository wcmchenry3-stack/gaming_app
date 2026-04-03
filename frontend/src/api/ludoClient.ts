import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import { getOrCreateSessionId } from "./client";

const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}`;

Sentry.addBreadcrumb({
  category: "api.config",
  message: `Ludo API: BASE_URL=${BASE_URL}, platform=${Platform.OS}`,
  level: "info",
});

export interface PieceResponse {
  index: number;
  position: number; // -1=base, 0-51=outer track, 52-57=red home col, 64-69=yellow home col, 100=finished
  is_home: boolean;
  is_finished: boolean;
}

export interface PlayerStateResponse {
  player_id: string;
  pieces: PieceResponse[];
  pieces_home: number;
  pieces_finished: number;
}

export interface LudoState {
  phase: string; // "roll" | "move" | "game_over"
  players: string[];
  current_player: string;
  die_value: number | null;
  valid_moves: number[];
  player_states: PlayerStateResponse[];
  winner: string | null;
  extra_turn: boolean;
  cpu_player: string | null;
  last_event: string | null;
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
        tags: { api: "ludo", errorType: "network" },
      });
    }
    throw e;
  }
}

export const ludoApi = {
  newSession: () => request<LudoState>("/ludo/new", { method: "POST" }),

  getState: () => request<LudoState>("/ludo/state"),

  roll: () => request<LudoState>("/ludo/roll", { method: "POST" }),

  move: (piece_index: number) =>
    request<LudoState>("/ludo/move", {
      method: "POST",
      body: JSON.stringify({ piece_index }),
    }),

  newGame: () => request<LudoState>("/ludo/new-game", { method: "POST" }),
};
