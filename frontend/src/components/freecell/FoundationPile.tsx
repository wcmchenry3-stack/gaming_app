import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeContext";
import SharedPlayingCard from "../shared/PlayingCard";
import { rankLabel } from "../../game/_shared/decks/cardId";
import type { CanonicalSuit } from "../../game/_shared/decks/types";
import type { Card, Suit } from "../../game/freecell/types";
import { CARD_WIDTH, CARD_HEIGHT } from "./FreeCellSlot";

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export interface FoundationPileProps {
  readonly pile: readonly Card[];
  readonly suit: Suit;
  readonly selected?: boolean;
  readonly onPress?: (suit: Suit) => void;
}

export default function FoundationPile({
  pile,
  suit,
  selected = false,
  onPress,
}: FoundationPileProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("freecell");

  if (pile.length > 0) {
    const top = pile[pile.length - 1];
    if (top !== undefined) {
      const rl = rankLabel(top.rank);
      const suitName = t(`suit.${top.suit}` as const);
      const label = selected
        ? t("card.selected", { rank: rl, suit: suitName })
        : t("card.label", { rank: rl, suit: suitName });
      return (
        <SharedPlayingCard
          suit={top.suit as CanonicalSuit}
          rank={top.rank}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          highlighted={selected}
          onPress={onPress ? () => onPress(suit) : undefined}
          accessibilityLabel={label}
        />
      );
    }
  }

  const label = t("pile.foundation.empty", { suit: t(`suit.${suit}` as const) });
  const pileStyle = [
    styles.empty,
    {
      borderColor: selected ? colors.accent : colors.border,
      borderWidth: selected ? 2 : 1,
      backgroundColor: colors.background,
    },
  ];
  const content = (
    <Text style={[styles.suit, { color: colors.textMuted }]}>{SUIT_SYMBOL[suit]}</Text>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => onPress(suit)}
        style={pileStyle}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={pileStyle} accessibilityRole="image" accessibilityLabel={label}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  suit: {
    fontSize: 24,
    lineHeight: 28,
  },
});
