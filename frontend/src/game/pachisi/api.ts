/**
 * Pachisi API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { PachisiState } from "./types";

const request = createGameClient({ apiTag: "pachisi" });

export const pachisiApi = {
  newSession: () => request<PachisiState>("/pachisi/new", { method: "POST" }),

  getState: () => request<PachisiState>("/pachisi/state"),

  roll: () => request<PachisiState>("/pachisi/roll", { method: "POST" }),

  move: (piece_index: number) =>
    request<PachisiState>("/pachisi/move", {
      method: "POST",
      body: JSON.stringify({ piece_index }),
    }),

  newGame: () => request<PachisiState>("/pachisi/new-game", { method: "POST" }),
};

// Re-export types for import-site convenience.
export type { PieceResponse, PlayerStateResponse, PachisiState } from "./types";
