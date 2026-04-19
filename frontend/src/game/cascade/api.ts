/**
 * Cascade API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { LeaderboardResponse, ScoreEntry } from "./types";

const request = createGameClient({ apiTag: "cascade" });

export const cascadeApi = {
  submitPlayerName: (gameId: string, player_name: string) =>
    request<ScoreEntry>(`/cascade/score/${gameId}`, {
      method: "PATCH",
      body: JSON.stringify({ player_name }),
    }),

  getLeaderboard: () => request<LeaderboardResponse>("/cascade/scores"),
};

// Re-export types for import-site convenience.
export type { ScoreEntry, LeaderboardResponse } from "./types";
