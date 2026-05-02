/**
 * Hearts AI (#606).
 *
 * Pure TypeScript rule-based strategy for the 3 computer opponents.
 * Medium difficulty — human-beatable but not trivial (~1-in-4 AI win rate).
 * No randomness beyond deterministic tie-breaking. No React/AsyncStorage.
 */

import { getValidPlays } from "./engine";
import type { Card, HeartsState, PassDirection, TrickCard } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isQueenOfSpades(c: Card): boolean {
  return c.suit === "spades" && c.rank === 12;
}

function cardPoints(c: Card): number {
  if (c.suit === "hearts") return 1;
  if (isQueenOfSpades(c)) return 13;
  return 0;
}

function trickPoints(trick: readonly TrickCard[]): number {
  return trick.reduce((sum, tc) => sum + cardPoints(tc.card), 0);
}

const aceHigh = (rank: number): number => (rank === 1 ? 14 : rank);

/** Highest card in array, or undefined if empty. */
function highest(cards: Card[]): Card | undefined {
  return cards.reduce<Card | undefined>((best, c) => {
    if (!best) return c;
    return aceHigh(c.rank) > aceHigh(best.rank) ? c : best;
  }, undefined);
}

/** Lowest card in array, or undefined if empty. */
function lowest(cards: Card[]): Card | undefined {
  return cards.reduce<Card | undefined>((best, c) => {
    if (!best) return c;
    return aceHigh(c.rank) < aceHigh(best.rank) ? c : best;
  }, undefined);
}

/** Group cards by suit, returning an array of [suit, cards] sorted by count desc. */
function bySuitDescending(cards: Card[]): Array<[string, Card[]]> {
  const map = new Map<string, Card[]>();
  for (const c of cards) {
    const group = map.get(c.suit) ?? [];
    group.push(c);
    map.set(c.suit, group);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

// ---------------------------------------------------------------------------
// Passing strategy
// ---------------------------------------------------------------------------

/**
 * Select exactly 3 cards to pass. Priority order per issue spec:
 * 1. Q♠ — unless protected (holding A♠ + K♠) or void in spades
 * 2. A♥, K♥ — highest hearts first
 * 3. A♠, K♠ — if not needed to protect Q♠
 * 4. High cards of suit being voided (longest suit)
 * 5. Never pass: 2♣ or clubs below 6
 */
export function selectCardsToPass(hand: Card[], direction: PassDirection): Card[] {
  void direction;
  const selected: Card[] = [];

  const has = (suit: string, rank: number) => hand.some((c) => c.suit === suit && c.rank === rank);

  const spades = hand.filter((c) => c.suit === "spades");
  const hasQSpades = spades.some(isQueenOfSpades);
  const hasASpades = has("spades", 1);
  const hasKSpades = has("spades", 13);
  const qSpadeProtected = hasASpades && hasKSpades;
  const voidInSpades = spades.length === 0;

  // 1. Pass Q♠ if unprotected and not void
  if (hasQSpades && !qSpadeProtected && !voidInSpades) {
    selected.push({ suit: "spades", rank: 12 });
  }

  // Cards eligible to pass (never 2♣, never clubs < 6)
  const safe = (c: Card) => {
    if (selected.some((s) => s.suit === c.suit && s.rank === c.rank)) return false;
    if (c.suit === "clubs" && c.rank === 2) return false;
    if (c.suit === "clubs" && c.rank < 6) return false;
    return true;
  };

  // 2. High hearts (A=1, K=13 — pass rank 13 first, then rank 1 as highest)
  const dangerHearts = hand
    .filter((c) => c.suit === "hearts" && (c.rank === 1 || c.rank >= 11) && safe(c))
    .sort((a, b) => {
      // Treat ace (rank 1) as 14 for sorting purposes
      const ra = a.rank === 1 ? 14 : a.rank;
      const rb = b.rank === 1 ? 14 : b.rank;
      return rb - ra;
    });
  for (const c of dangerHearts) {
    if (selected.length >= 3) break;
    selected.push(c);
  }

  // 3. A♠, K♠ — if not protecting Q♠
  if (selected.length < 3 && !hasQSpades) {
    for (const rank of [1, 13] as const) {
      if (selected.length >= 3) break;
      const card = hand.find((c) => c.suit === "spades" && c.rank === rank && safe(c));
      if (card) selected.push(card);
    }
  }

  // 4. High cards toward voiding a suit
  if (selected.length < 3) {
    const candidates = hand.filter(safe).sort((a, b) => {
      // Prefer high ranks, prefer non-clubs
      const ra = a.rank === 1 ? 14 : a.rank;
      const rb = b.rank === 1 ? 14 : b.rank;
      if (rb !== ra) return rb - ra;
      if (a.suit === "clubs" && b.suit !== "clubs") return 1;
      if (b.suit === "clubs" && a.suit !== "clubs") return -1;
      return 0;
    });
    for (const c of candidates) {
      if (selected.length >= 3) break;
      selected.push(c);
    }
  }

  return selected.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Moon detection
// ---------------------------------------------------------------------------

/**
 * Returns the player index who is on track to shoot the moon, or null.
 * Fires when a player has ≥ 4 hearts (or Q♠) and no other player has
 * taken any points yet this hand.
 */
export function detectPotentialMoon(state: HeartsState): number | null {
  const totalPointsTaken = state.handScores.reduce((s, v) => s + (v ?? 0), 0);
  if (totalPointsTaken === 0) return null;

  for (let i = 0; i < 4; i++) {
    const myPoints = state.handScores[i] ?? 0;
    if (myPoints === 0) continue;
    // This player has all the points so far
    if (myPoints === totalPointsTaken) {
      const myCards = state.wonCards[i] ?? [];
      const hearts = myCards.filter((c) => c.suit === "hearts").length;
      const hasQ = myCards.some(isQueenOfSpades);
      if (hearts + (hasQ ? 1 : 0) >= 4) return i;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Play strategy
// ---------------------------------------------------------------------------

/**
 * Choose a card to play. Always returns a card from getValidPlays.
 *
 * Priority when void (discarding):
 *   1. Dump Q♠ if unprotected
 *   2. Dump highest ♥
 *   3. Dump highest card of longest suit (work toward voiding)
 *
 * Priority when following suit:
 *   - Trick safe (no points) and last to play → play highest to exhaust high cards
 *   - Trick has points → play highest card that still loses
 *   - Would win regardless → play lowest
 *
 * Priority when leading:
 *   - Moon blocking: dump hearts/Q♠ immediately
 *   - First trick: 2♣ (forced by getValidPlays)
 *   - Hearts not broken: lead lowest of longest non-heart suit
 *   - Otherwise: lead lowest non-dangerous card
 */
export function selectCardToPlay(
  hand: Card[],
  trick: TrickCard[],
  state: HeartsState,
  playerIndex: number
): Card {
  const valid = getValidPlays(state, playerIndex);
  if (valid.length === 1) return valid[0]!;

  const moonTarget = detectPotentialMoon(state);
  const isLeading = trick.length === 0;

  // Moon blocking — dump points cards ASAP
  if (moonTarget !== null && moonTarget !== playerIndex) {
    const pointCards = valid.filter((c) => cardPoints(c) > 0).sort((a, b) => aceHigh(b.rank) - aceHigh(a.rank));
    if (pointCards.length > 0) return pointCards[0]!;
  }

  if (isLeading) {
    return chooseLead(valid);
  }

  return chooseFollow(valid, trick);
}

function chooseLead(valid: Card[]): Card {
  // Avoid leading hearts or Q♠ unless forced
  const safe = valid.filter((c) => c.suit !== "hearts" && !isQueenOfSpades(c));
  const pool = safe.length > 0 ? safe : valid;

  // Lead lowest of longest non-heart suit (exhaust safe suits first)
  const suitGroups = bySuitDescending(pool);
  const longestGroup = suitGroups[0];
  if (longestGroup) {
    const card = lowest(longestGroup[1]);
    if (card) return card;
  }

  return lowest(pool) ?? valid[0]!;
}

function chooseFollow(valid: Card[], trick: readonly TrickCard[]): Card {
  const first = trick[0];
  if (!first) return valid[0]!;

  const ledSuit = first.card.suit;
  const inSuit = valid.filter((c) => c.suit === ledSuit);
  const isVoid = inSuit.length === 0;

  if (isVoid) {
    return chooseDiscard(valid);
  }

  // Following suit
  const isLastToPlay = trick.length === 3;
  const pts = trickPoints(trick);

  // Find the highest card currently winning the trick in led suit
  let winningRank = 0;
  for (const tc of trick) {
    if (tc.card.suit === ledSuit && aceHigh(tc.card.rank) > winningRank) {
      winningRank = aceHigh(tc.card.rank);
    }
  }

  // Cards that would lose (ace-high rank < winning rank)
  const losing = inSuit.filter((c) => aceHigh(c.rank) < winningRank);

  if (pts === 0 && isLastToPlay) {
    // Safe trick, last to play — exhaust high cards
    return highest(inSuit) ?? valid[0]!;
  }

  if (pts > 0) {
    // Trick has points — try to lose
    if (losing.length > 0) {
      // Play highest card that still loses
      return highest(losing) ?? valid[0]!;
    }
    // Must win — play lowest to minimize damage
    return lowest(inSuit) ?? valid[0]!;
  }

  // No points, not last — play lowest to stay safe
  return lowest(inSuit) ?? valid[0]!;
}

function chooseDiscard(valid: Card[]): Card {
  // 1. Dump Q♠ if in valid plays
  const qSpades = valid.find(isQueenOfSpades);
  if (qSpades) return qSpades;

  // 2. Dump highest heart
  const hearts = valid.filter((c) => c.suit === "hearts").sort((a, b) => aceHigh(b.rank) - aceHigh(a.rank));
  if (hearts.length > 0) return hearts[0]!;

  // 3. Dump highest card of longest suit
  const groups = bySuitDescending(valid);
  const longestGroup = groups[0];
  if (longestGroup) {
    const card = highest(longestGroup[1]);
    if (card) return card;
  }

  return valid[0]!;
}
