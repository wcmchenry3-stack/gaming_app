/**
 * Blackjack API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { BlackjackState } from "./types";

const request = createGameClient({ apiTag: "blackjack" });

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

// Re-export types for import-site convenience.
export type { CardResponse, HandResponse, BlackjackState } from "./types";
