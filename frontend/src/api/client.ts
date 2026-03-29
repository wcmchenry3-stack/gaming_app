const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
// Render's fromService can inject a bare subdomain slug (e.g. "yahtzee-api-fql1")
// without a protocol or the .onrender.com suffix. Normalise to a full URL.
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

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
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
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
