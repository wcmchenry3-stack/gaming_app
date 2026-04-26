/**
 * Sudoku API client (#619, #748).
 *
 * Scores are partitioned by (variant, difficulty) server-side (#748),
 * so both submit and read endpoints carry both parameters. variant
 * defaults to "classic" for backwards compatibility.
 */

import { createGameClient } from "../_shared/httpClient";
import type { Difficulty, Variant } from "./types";

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
  submitScore: (
    player_name: string,
    score: number,
    difficulty: Difficulty,
    variant: Variant = "classic"
  ) =>
    request<ScoreEntry>("/sudoku/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score, difficulty, variant }),
    }),
  getLeaderboard: (difficulty: Difficulty, variant: Variant = "classic") =>
    request<LeaderboardResponse>(`/sudoku/scores/${difficulty}?variant=${variant}`),
};
