import AsyncStorage from "@react-native-async-storage/async-storage";

const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
// Render's fromService can inject a bare subdomain slug (e.g. "yahtzee-api-fql1")
// without a protocol or the .onrender.com suffix. Normalise to a full URL.
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

const SESSION_KEY = "game_session_id";

async function getOrCreateSessionId(): Promise<string> {
  let sid = await AsyncStorage.getItem(SESSION_KEY);
  if (!sid) {
    // crypto.randomUUID() is available in React Native (Hermes) and modern browsers
    sid = crypto.randomUUID();
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
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
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
