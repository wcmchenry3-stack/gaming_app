/**
 * Client-side Blackjack engine.
 *
 * Ported from backend/blackjack/game.py. Pure functions, immutable state.
 * After this port, BlackjackScreen runs the engine locally and makes no
 * HTTP requests during gameplay.
 *
 * Internal engine state carries the full deck and both hands (plus
 * `_doubled` flag). `toViewState()` produces a `BlackjackState` matching
 * the existing UI type, concealing the dealer's hole card during the
 * player phase (mirrors backend's conceal behavior).
 */

import { BlackjackState, CardResponse, HandResponse } from "./types";

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

const RANK_VALUES: Record<string, number> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
};

const RESHUFFLE_THRESHOLD = 15;

export interface Card {
  suit: string;
  rank: string;
}

/**
 * Full engine state — kept in memory + AsyncStorage. The UI never sees
 * this directly; it consumes `toViewState(engineState)` instead.
 */
export interface EngineState {
  chips: number;
  bet: number;
  phase: "betting" | "player" | "result";
  outcome: "blackjack" | "win" | "lose" | "push" | null;
  payout: number;
  deck: Card[];
  player_hand: Card[];
  dealer_hand: Card[];
  doubled: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function handValue(cards: readonly Card[]): number {
  if (cards.length === 0) return 0;
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += RANK_VALUES[c.rank];
    if (c.rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isNaturalBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

function freshShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ suit: s, rank: r });
    }
  }
  // Fisher–Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Draw one card from a deck. Returns the new deck (with one fewer card)
 * and the drawn card. Auto-reshuffles if the deck runs dry mid-draw.
 */
function deal(deck: Card[]): { deck: Card[]; card: Card } {
  const working = deck.length === 0 ? freshShuffledDeck() : deck;
  const next = [...working];
  const card = next.pop()!;
  return { deck: next, card };
}

// ---------------------------------------------------------------------------
// View projection
// ---------------------------------------------------------------------------

function handResponse(cards: readonly Card[], concealHole: boolean): HandResponse {
  const cardResponses: CardResponse[] = cards.map((c, i) => {
    if (concealHole && i === 0) {
      return { rank: "?", suit: "?", face_down: true };
    }
    return { rank: c.rank, suit: c.suit, face_down: false };
  });
  const value = concealHole ? 0 : handValue(cards);
  return { cards: cardResponses, value };
}

export function toViewState(s: EngineState): BlackjackState {
  const concealing = s.phase === "player";
  const double_down_available =
    s.phase === "player" && s.player_hand.length === 2 && s.chips >= s.bet;
  const game_over = s.chips === 0 && s.phase === "result";
  return {
    phase: s.phase,
    chips: s.chips,
    bet: s.bet,
    player_hand: handResponse(s.player_hand, false),
    dealer_hand: handResponse(s.dealer_hand, concealing),
    outcome: s.outcome,
    payout: s.payout,
    game_over,
    double_down_available,
  };
}

// ---------------------------------------------------------------------------
// Public API — pure state transitions
// ---------------------------------------------------------------------------

export function newGame(): EngineState {
  return {
    chips: 1000,
    bet: 0,
    phase: "betting",
    outcome: null,
    payout: 0,
    deck: freshShuffledDeck(),
    player_hand: [],
    dealer_hand: [],
    doubled: false,
  };
}

function settleWith(s: EngineState, outcome: "blackjack" | "win" | "lose" | "push"): EngineState {
  let delta = 0;
  if (outcome === "blackjack") delta = Math.ceil(s.bet * 1.5);
  else if (outcome === "win") delta = s.bet;
  else if (outcome === "lose") delta = -s.bet;
  // push: delta 0
  return {
    ...s,
    outcome,
    payout: delta,
    chips: Math.max(0, s.chips + delta),
    phase: "result",
  };
}

export function placeBet(s: EngineState, amount: number): EngineState {
  if (s.phase !== "betting") throw new Error("Not in betting phase.");
  if (amount < 10 || amount > 500 || amount % 10 !== 0) {
    throw new Error("Bet must be between 10 and 500 in multiples of 10.");
  }
  if (amount > s.chips) throw new Error("Insufficient chips.");

  // Deal player, dealer, player, dealer
  let deck = s.deck;
  const playerHand: Card[] = [];
  const dealerHand: Card[] = [];
  for (let i = 0; i < 2; i++) {
    let r = deal(deck);
    deck = r.deck;
    playerHand.push(r.card);
    r = deal(deck);
    deck = r.deck;
    dealerHand.push(r.card);
  }

  const afterDeal: EngineState = {
    ...s,
    bet: amount,
    doubled: false,
    outcome: null,
    payout: 0,
    deck,
    player_hand: playerHand,
    dealer_hand: dealerHand,
  };

  // Natural blackjack check
  if (isNaturalBlackjack(playerHand)) {
    return settleWith(afterDeal, isNaturalBlackjack(dealerHand) ? "push" : "blackjack");
  }
  return { ...afterDeal, phase: "player" };
}

export function hit(s: EngineState): EngineState {
  if (s.phase !== "player") throw new Error("Not in player phase.");
  const { deck, card } = deal(s.deck);
  const next: EngineState = {
    ...s,
    deck,
    player_hand: [...s.player_hand, card],
  };
  if (handValue(next.player_hand) > 21) {
    return settleWith(next, "lose");
  }
  return next;
}

function dealerPlay(s: EngineState): EngineState {
  let working = s;
  while (handValue(working.dealer_hand) <= 16) {
    const { deck, card } = deal(working.deck);
    working = { ...working, deck, dealer_hand: [...working.dealer_hand, card] };
  }
  return working;
}

function determineAndSettle(s: EngineState): EngineState {
  const pv = handValue(s.player_hand);
  const dv = handValue(s.dealer_hand);
  const dealerBust = dv > 21;
  if (dealerBust || pv > dv) return settleWith(s, "win");
  if (pv === dv) return settleWith(s, "push");
  return settleWith(s, "lose");
}

export function stand(s: EngineState): EngineState {
  if (s.phase !== "player") throw new Error("Not in player phase.");
  return determineAndSettle(dealerPlay(s));
}

export function doubleDown(s: EngineState): EngineState {
  if (s.phase !== "player") throw new Error("Not in player phase.");
  if (s.player_hand.length !== 2) {
    throw new Error("Double down only allowed on initial two cards.");
  }
  if (s.chips < s.bet) throw new Error("Insufficient chips to double down.");

  // Deduct extra bet now + double the bet
  const { deck, card } = deal(s.deck);
  const afterDouble: EngineState = {
    ...s,
    chips: s.chips - s.bet,
    bet: s.bet * 2,
    doubled: true,
    deck,
    player_hand: [...s.player_hand, card],
  };

  if (handValue(afterDouble.player_hand) > 21) {
    return settleWith(afterDouble, "lose");
  }
  return determineAndSettle(dealerPlay(afterDouble));
}

export function newHand(s: EngineState): EngineState {
  if (s.phase !== "result") throw new Error("Not in result phase.");
  const deck = s.deck.length < RESHUFFLE_THRESHOLD ? freshShuffledDeck() : s.deck;
  return {
    ...s,
    phase: "betting",
    bet: 0,
    outcome: null,
    payout: 0,
    doubled: false,
    deck,
    player_hand: [],
    dealer_hand: [],
  };
}
