const _apiUrl =
  process.env.EXPO_PUBLIC_API_URL ?? "https://yahtzee-api-fql1.onrender.com";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

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
