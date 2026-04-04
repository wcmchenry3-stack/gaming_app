/**
 * Cascade API client.
 */

import { createGameClient } from "../_shared/httpClient";
import { LeaderboardResponse, ScoreEntry } from "./types";

const request = createGameClient({ apiTag: "cascade" });

export const cascadeApi = {
  submitScore: (player_name: string, score: number) =>
    request<ScoreEntry>("/cascade/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score }),
    }),

  getLeaderboard: () => request<LeaderboardResponse>("/cascade/scores"),
};

// Re-export types for import-site convenience.
export type { ScoreEntry, LeaderboardResponse } from "./types";
