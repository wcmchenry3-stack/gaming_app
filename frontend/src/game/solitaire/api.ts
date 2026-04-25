/**
 * Solitaire API client (#597).
 *
 * One endpoint: POST /solitaire/score. Mirrors the Cascade client shape
 * (createGameClient + typed wrapper) so future additions (GET /scores
 * for an in-app leaderboard, for instance) slot in naturally.
 */

import { createGameClient } from "../_shared/httpClient";

const request = createGameClient({ apiTag: "solitaire" });

export interface ScoreEntry {
  readonly player_name: string;
  readonly score: number;
  /** 1-indexed; 11 when the submit didn't make the top 10. */
  readonly rank: number;
}

export interface LeaderboardResponse {
  readonly scores: readonly ScoreEntry[];
}

export const solitaireApi = {
  submitScore: (player_name: string, score: number) =>
    request<ScoreEntry>("/solitaire/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score }),
    }),
  getLeaderboard: () => request<LeaderboardResponse>("/solitaire/scores"),
};
