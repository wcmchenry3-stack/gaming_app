export type CanonicalSuit = "spades" | "hearts" | "diamonds" | "clubs";

const SUIT_CODE: Record<CanonicalSuit, string> = {
  spades: "s",
  hearts: "h",
  diamonds: "d",
  clubs: "c",
};

/** Display label for text-based rendering — 10 stays "10", not "T". */
const RANK_DISPLAY: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

/** Cardmeister cid rank codes — ten is "T" per poker notation. */
const RANK_CID: Record<number, string> = {
  1: "A",
  10: "T",
  11: "J",
  12: "Q",
  13: "K",
};

/** Returns the rank label used in text-based card rendering (A, 2-10, J, Q, K). */
export function rankLabel(rank: number): string {
  return RANK_DISPLAY[rank] ?? String(rank);
}

/** Returns the emoji suit symbol for the given canonical suit name. */
export function suitEmoji(suit: CanonicalSuit): string {
  const map: Record<CanonicalSuit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
  };
  return map[suit];
}

/** Returns the cardmeister `cid` attribute value (e.g. "As", "Tc", "Qh"). */
export function cardmeisterId(suit: CanonicalSuit, rank: number): string {
  return `${RANK_CID[rank] ?? String(rank)}${SUIT_CODE[suit]}`;
}

export const RED_SUITS: ReadonlySet<CanonicalSuit> = new Set(["hearts", "diamonds"]);
