/**
 * Mahjong Solitaire API client (#872).
 *
 * Two endpoints: POST /mahjong/score and GET /mahjong/scores.
 * Score submission is called by the ScoreQueue handler in scoreSync.ts —
 * screens call `scoreQueue.enqueue("mahjong", ...)` instead of this directly.
 */

import { createGameClient } from "../_shared/httpClient";

const request = createGameClient({ apiTag: "mahjong" });

export interface ScoreEntry {
  readonly player_name: string;
  readonly score: number;
  /** 1-indexed; 11 when the submit didn't make the top 10. */
  readonly rank: number;
}

export interface LeaderboardResponse {
  readonly scores: readonly ScoreEntry[];
}

export const mahjongApi = {
  submitScore: (player_name: string, score: number) =>
    request<ScoreEntry>("/mahjong/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score }),
    }),
  getLeaderboard: () => request<LeaderboardResponse>("/mahjong/scores"),
};
