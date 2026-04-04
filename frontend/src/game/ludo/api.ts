/**
 * Ludo API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { LudoState } from "./types";

const request = createGameClient({ apiTag: "ludo" });

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

// Re-export types for import-site convenience.
export type { PieceResponse, PlayerStateResponse, LudoState } from "./types";
