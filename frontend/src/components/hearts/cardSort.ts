import type { Card } from "../../game/hearts/types";

// Canonical suit order: ♣ ♦ ♠ ♥ (clubs first, hearts last)
const SUIT_ORDER: Record<Card["suit"], number> = {
  clubs: 0,
  diamonds: 1,
  spades: 2,
  hearts: 3,
};

// Ace sorts high (as 14)
function sortRank(rank: number): number {
  return rank === 1 ? 14 : rank;
}

export function sortHand(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return suitDiff;
    return sortRank(a.rank) - sortRank(b.rank);
  });
}
