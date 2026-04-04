/**
 * Yacht API client.
 *
 * Note: paths still use the legacy `/game/` prefix rather than `/yacht/`;
 * renaming is tracked in #161.
 */

import { createGameClient } from "../_shared/httpClient";
import { GameState, PossibleScores } from "./types";

const request = createGameClient({ apiTag: "gaming-app" });

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

// Re-export types for import-site convenience.
export type { GameState, PossibleScores } from "./types";
