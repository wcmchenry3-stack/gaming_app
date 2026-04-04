/**
 * Yacht API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { GameState, PossibleScores } from "./types";

const request = createGameClient({ apiTag: "gaming-app" });

export const api = {
  newGame: () => request<GameState>("/yacht/new", { method: "POST" }),

  getState: () => request<GameState>("/yacht/state"),

  roll: (held: boolean[]) =>
    request<GameState>("/yacht/roll", {
      method: "POST",
      body: JSON.stringify({ held }),
    }),

  score: (category: string) =>
    request<GameState>("/yacht/score", {
      method: "POST",
      body: JSON.stringify({ category }),
    }),

  possibleScores: () => request<PossibleScores>("/yacht/possible-scores"),
};

// Re-export types for import-site convenience.
export type { GameState, PossibleScores } from "./types";
