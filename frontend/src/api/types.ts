/**
 * Shared types for the stats + games read API (#365).
 *
 * Mirrors the Pydantic response models in backend/games/schemas.py. Keep
 * these in sync when the backend contract changes.
 */

export type { GameOutcome } from "./vocab";

export interface GameTypeStats {
  played: number;
  best: number | null;
  avg: number | null;
  last_played_at: string | null;
  best_chips: number | null;
  current_chips: number | null;
}

export interface StatsResponse {
  total_games: number;
  by_game: Record<string, GameTypeStats>;
  favorite_game: string | null;
}

export interface GameRow {
  id: string;
  game_type: string;
  started_at: string;
  completed_at: string | null;
  final_score: number | null;
  outcome: GameOutcome | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface GameHistoryResponse {
  items: GameRow[];
  next_cursor: string | null;
}

export interface GameEventRow {
  event_index: number;
  event_type: string;
  occurred_at: string;
  data: Record<string, unknown>;
}

export interface GameDetailResponse extends GameRow {
  events?: GameEventRow[] | null;
}
