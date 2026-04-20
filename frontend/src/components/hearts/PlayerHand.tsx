import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import PlayingCard from "./PlayingCard";
import type { Card } from "../../game/hearts/types";

interface Props {
  hand: Card[];
  selectedCards?: Card[];
  validCards?: Card[];
  onCardPress?: (card: Card) => void;
}

function cardKey(c: Card): string {
  return `${c.suit}-${c.rank}`;
}

function inSet(cards: Card[] | undefined, card: Card): boolean {
  if (!cards) return false;
  return cards.some((c) => c.suit === card.suit && c.rank === card.rank);
}

export default function PlayerHand({ hand, selectedCards, validCards, onCardPress }: Props) {
  const { t } = useTranslation("hearts");

  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.container}
      accessibilityLabel={t("hand.player", { count: hand.length })}
      accessibilityRole="none"
      showsHorizontalScrollIndicator={false}
    >
      {hand.map((card) => {
        const highlighted = inSet(selectedCards, card);
        const disabled = validCards !== undefined && !inSet(validCards, card);
        return (
          <PlayingCard
            key={cardKey(card)}
            card={card}
            highlighted={highlighted}
            disabled={disabled}
            onPress={onCardPress ? () => onCardPress(card) : undefined}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
});
