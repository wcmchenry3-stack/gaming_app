/**
 * Sudoku API client (#619).
 *
 * Mirrors the Solitaire/Hearts pattern (createGameClient + typed
 * wrapper).  Scores are partitioned by difficulty server-side (#615),
 * so both submit and read endpoints carry the difficulty.
 */

import { createGameClient } from "../_shared/httpClient";
import type { Difficulty } from "./types";

const request = createGameClient({ apiTag: "sudoku" });

export interface ScoreEntry {
  readonly player_name: string;
  readonly score: number;
  /** 1-indexed; 11 when the submit didn't make the top 10. */
  readonly rank: number;
}

export interface LeaderboardResponse {
  readonly scores: readonly ScoreEntry[];
}

export const sudokuApi = {
  submitScore: (player_name: string, score: number, difficulty: Difficulty) =>
    request<ScoreEntry>("/sudoku/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score, difficulty }),
    }),
  getLeaderboard: (difficulty: Difficulty) =>
    request<LeaderboardResponse>(`/sudoku/scores/${difficulty}`),
};
