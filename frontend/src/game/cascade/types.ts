/**
 * Cascade API response shapes.
 */

export interface ScoreEntry {
  player_name: string;
  score: number;
  /** 1-indexed position in the leaderboard after this submission. */
  rank: number;
}

export interface LeaderboardResponse {
  scores: ScoreEntry[];
}
