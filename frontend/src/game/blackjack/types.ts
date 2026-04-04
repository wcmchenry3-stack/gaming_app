/**
 * Blackjack API response shapes.
 */

export interface CardResponse {
  rank: string;
  suit: string;
  face_down: boolean;
}

export interface HandResponse {
  cards: CardResponse[];
  value: number;
}

export interface BlackjackState {
  phase: string; // "betting" | "player" | "result"
  chips: number;
  bet: number;
  player_hand: HandResponse;
  dealer_hand: HandResponse;
  outcome: string | null; // "blackjack" | "win" | "lose" | "push" | null
  payout: number;
  game_over: boolean;
  double_down_available: boolean;
}
