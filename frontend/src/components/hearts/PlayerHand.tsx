import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import PlayingCard from "./PlayingCard";
import type { Card } from "../../game/hearts/types";

interface Props {
  hand: Card[];
  selectedCards?: Card[];
  validCards?: Card[];
  onCardPress?: (card: Card) => void;
}

// Canonical suit order: ♣ ♦ ♠ ♥ (clubs first, hearts last)
const SUIT_ORDER: Record<string, number> = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };

// Ace sorts high (as 14)
function sortRank(rank: number): number {
  return rank === 1 ? 14 : rank;
}

function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
    if (suitDiff !== 0) return suitDiff;
    return sortRank(a.rank) - sortRank(b.rank);
  });
}

function inSet(cards: Card[] | undefined, card: Card): boolean {
  if (!cards) return false;
  return cards.some((c) => c.suit === card.suit && c.rank === card.rank);
}

function cardKey(c: Card): string {
  return `${c.suit}-${c.rank}`;
}

const CARD_WIDTH = 52;
const CARD_HEIGHT = 74;
const POP_AMOUNT = 16;
const H_PADDING = 8;

export default function PlayerHand({ hand, selectedCards, validCards, onCardPress }: Props) {
  const { t } = useTranslation("hearts");
  const { width: screenWidth } = useWindowDimensions();

  const sorted = sortHand(hand);
  const count = sorted.length;
  const availableWidth = screenWidth - H_PADDING * 2;

  // Overlap offset so all cards fit without scroll; rightmost card is fully visible.
  const offset =
    count > 1 ? Math.min((availableWidth - CARD_WIDTH) / (count - 1), CARD_WIDTH + 4) : 0;
  const containerWidth = count > 1 ? offset * (count - 1) + CARD_WIDTH : CARD_WIDTH;

  return (
    <View
      style={[styles.wrapper, { paddingHorizontal: H_PADDING }]}
      accessibilityLabel={t("hand.player", { count })}
      accessibilityRole="none"
    >
      <View style={[styles.container, { width: containerWidth, height: CARD_HEIGHT + POP_AMOUNT }]}>
        {sorted.map((card, i) => {
          const highlighted = inSet(selectedCards, card);
          const disabled = validCards !== undefined && !inSet(validCards, card);
          const popped = highlighted;
          return (
            <View
              key={cardKey(card)}
              style={[
                styles.cardSlot,
                { left: i * offset, zIndex: i },
                popped && styles.poppedSlot,
              ]}
            >
              <PlayingCard
                card={card}
                highlighted={highlighted}
                disabled={disabled}
                onPress={onCardPress ? () => onCardPress(card) : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  container: {
    position: "relative",
  },
  cardSlot: {
    position: "absolute",
    top: POP_AMOUNT,
  },
  poppedSlot: {
    top: 0,
  },
});
