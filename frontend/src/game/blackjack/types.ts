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
  /** True when at least one Ace is counted as 11 (soft hand). */
  soft: boolean;
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
  split_available: boolean;
  // Multi-hand split fields
  player_hands: HandResponse[];
  hand_bets: number[];
  active_hand_index: number;
  hand_outcomes: (string | null)[];
  hand_payouts: number[];
}
