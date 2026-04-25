import { createGameClient } from "../_shared/httpClient";

const request = createGameClient({ apiTag: "hearts" });

export interface ScoreEntry {
  readonly player_name: string;
  readonly score: number;
  readonly rank: number;
}

export interface LeaderboardResponse {
  readonly scores: readonly ScoreEntry[];
}

export const heartsApi = {
  submitScore: (player_name: string, score: number) =>
    request<ScoreEntry>("/hearts/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score }),
    }),
  getLeaderboard: () => request<LeaderboardResponse>("/hearts/scores"),
};
