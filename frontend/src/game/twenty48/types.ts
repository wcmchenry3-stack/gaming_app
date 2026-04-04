/**
 * Twenty48 API response shapes.
 */

export interface Twenty48State {
  board: number[][];
  score: number;
  game_over: boolean;
  has_won: boolean;
}
