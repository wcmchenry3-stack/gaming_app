/**
 * Sudoku API client (#619, #748, #901).
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
  submitPlayerName: (gameId: string, player_name: string) =>
    request<ScoreEntry>(`/sudoku/score/${gameId}`, {
      method: "PATCH",
      body: JSON.stringify({ player_name }),
    }),
  getLeaderboard: (difficulty: Difficulty, variant: Variant = "classic") =>
    request<LeaderboardResponse>(`/sudoku/scores/${difficulty}?variant=${variant}`),
};
