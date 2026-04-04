/**
 * Cascade API response shapes.
 */

export interface ScoreEntry {
  player_name: string;
  score: number;
}

export interface LeaderboardResponse {
  scores: ScoreEntry[];
}
