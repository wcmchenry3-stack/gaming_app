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

import { BlackjackState, CardResponse, GameRules, HandResponse } from "./types";

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

export const DEFAULT_RULES: GameRules = {
  hit_soft_17: false,
  deck_count: 6,
  penetration: 0.75,
};

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
  rules: GameRules;
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

/**
 * Returns true when at least one Ace in the hand is counted as 11.
 * A+6 = soft 17; A+6+K = hard 17 (Ace forced to 1).
 */
export function isSoftHand(cards: readonly Card[]): boolean {
  if (cards.length === 0) return false;
  let rawTotal = 0;
  let numAces = 0;
  for (const c of cards) {
    rawTotal += RANK_VALUES[c.rank];
    if (c.rank === "A") numAces += 1;
  }
  if (numAces === 0) return false;
  const best = handValue(cards);
  // Number of Aces that had to be reduced from 11 → 1 to stay ≤ 21
  const reductions = (rawTotal - best) / 10;
  return best <= 21 && numAces > reductions;
}

// ---------------------------------------------------------------------------
// Seedable RNG
//
// The deck shuffle goes through `_rng` so tests and e2e flows can pin the
// deal sequence with `setRng(createSeededRng(seed))`. Default is Math.random
// for normal gameplay. Tests that call setRng must restore Math.random in
// afterEach to avoid leaking determinism into later tests.
// ---------------------------------------------------------------------------

export type RandomSource = () => number;

let _rng: RandomSource = Math.random;

export function setRng(fn: RandomSource): void {
  _rng = fn;
}

/**
 * LCG (same parameters as Cascade's and Twenty48's seeded RNGs).
 * Deterministic for a given seed. Not cryptographic — testing only.
 */
export function createSeededRng(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function freshShuffledDeck(deckCount: number = 1): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ suit: s, rank: r });
      }
    }
  }
  // Fisher–Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// E2E test hook — exposed only when __DEV__ is true OR EXPO_PUBLIC_TEST_HOOKS
// is set (production e2e builds). Metro strips `if (__DEV__)` branches from
// production bundles; the EXPO_PUBLIC_TEST_HOOKS env var opts in explicitly
// for Playwright/Maestro flows that need deterministic deals against a
// production-shaped bundle. Call `globalThis.__blackjack_setSeed(n)` before
// the next `newGame()` (or after) — subsequent reshuffles will draw from
// the seeded stream too, so the entire session is reproducible.
const _devHook = typeof __DEV__ !== "undefined" && __DEV__;
const _testHook = process.env.EXPO_PUBLIC_TEST_HOOKS === "1";
if ((_devHook || _testHook) && typeof globalThis !== "undefined") {
  (globalThis as unknown as { __blackjack_setSeed?: (seed: number) => void }).__blackjack_setSeed =
    (seed: number) => {
      setRng(createSeededRng(seed));
    };
}

/**
 * Draw one card from a deck. Returns the new deck (with one fewer card)
 * and the drawn card. Auto-reshuffles if the deck runs dry mid-draw.
 */
function deal(deck: Card[], deckCount: number = 1): { deck: Card[]; card: Card } {
  const working = deck.length === 0 ? freshShuffledDeck(deckCount) : deck;
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
  const soft = concealHole ? false : isSoftHand(cards);
  return { cards: cardResponses, value, soft };
}

export function toViewState(s: EngineState): BlackjackState {
  const concealing = s.phase === "player";
  const double_down_available =
    s.phase === "player" && s.player_hand.length === 2 && s.chips >= s.bet * 2;
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
    rules: s.rules,
  };
}

// ---------------------------------------------------------------------------
// Public API — pure state transitions
// ---------------------------------------------------------------------------

export function newGame(deck?: Card[], rules?: GameRules): EngineState {
  const r = rules ?? DEFAULT_RULES;
  return {
    chips: 1000,
    bet: 0,
    phase: "betting",
    outcome: null,
    payout: 0,
    deck: deck ?? freshShuffledDeck(r.deck_count),
    player_hand: [],
    dealer_hand: [],
    doubled: false,
    rules: r,
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
    let r = deal(deck, s.rules.deck_count);
    deck = r.deck;
    playerHand.push(r.card);
    r = deal(deck, s.rules.deck_count);
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
  const { deck, card } = deal(s.deck, s.rules.deck_count);
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

function dealerShouldDraw(hand: readonly Card[], hitSoft17: boolean): boolean {
  const dv = handValue(hand);
  if (dv < 17) return true;
  if (dv === 17 && hitSoft17 && isSoftHand(hand)) return true;
  return false;
}

function dealerPlay(s: EngineState): EngineState {
  let working = s;
  while (dealerShouldDraw(working.dealer_hand, working.rules.hit_soft_17)) {
    const { deck, card } = deal(working.deck, working.rules.deck_count);
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
  // chips represents stack+wagered (placeBet does not deduct); the free
  // stack is chips-bet. Doubling requires another `bet` of free stack,
  // so the true requirement is chips >= 2*bet.
  if (s.chips < s.bet * 2) throw new Error("Insufficient chips to double down.");

  // Don't subtract from chips here — that would double-count the extra
  // wager. Doubling `bet` alone makes the settlement delta double, which
  // is correct under the "chips includes wagered" accounting used by
  // settleWith().
  const { deck, card } = deal(s.deck, s.rules.deck_count);
  const afterDouble: EngineState = {
    ...s,
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

function reshuffleThreshold(rules: GameRules): number {
  const totalCards = rules.deck_count * 52;
  return Math.max(RESHUFFLE_THRESHOLD, Math.floor(totalCards * (1 - rules.penetration)));
}

export function newHand(s: EngineState): EngineState {
  if (s.phase !== "result") throw new Error("Not in result phase.");
  const deck =
    s.deck.length < reshuffleThreshold(s.rules)
      ? freshShuffledDeck(s.rules.deck_count)
      : s.deck;
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
