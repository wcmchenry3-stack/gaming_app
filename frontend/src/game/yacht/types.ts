/**
 * Yacht API response shapes.
 */

export interface GameState {
  dice: number[];
  held: boolean[];
  rolls_used: number;
  round: number;
  scores: Record<string, number | null>;
  game_over: boolean;
  upper_subtotal: number;
  upper_bonus: number;
  yacht_bonus_count: number;
  yacht_bonus_total: number;
  total_score: number;
}

export interface PossibleScores {
  possible_scores: Record<string, number>;
}
