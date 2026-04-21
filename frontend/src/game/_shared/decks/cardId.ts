import type { CanonicalSuit } from "./types";

export type { CanonicalSuit };

const RANK_DISPLAY: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

/** Text label for a rank — A, 2-10, J, Q, K. */
export function rankLabel(rank: number): string {
  return RANK_DISPLAY[rank] ?? String(rank);
}

/** Unicode suit emoji for a canonical suit name. */
export function suitEmoji(suit: CanonicalSuit): string {
  const map: Record<CanonicalSuit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
  };
  return map[suit];
}

export const RED_SUITS: ReadonlySet<CanonicalSuit> = new Set(["hearts", "diamonds"]);
