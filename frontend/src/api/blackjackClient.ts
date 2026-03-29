const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

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
