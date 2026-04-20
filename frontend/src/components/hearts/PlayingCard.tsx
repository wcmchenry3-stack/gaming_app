import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import type { Card } from "../../game/hearts/types";

interface Props {
  card: Card;
  faceDown?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

const SUIT_SYMBOL: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RED_SUITS = new Set(["hearts", "diamonds"]);

function rankDisplay(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

export default function PlayingCard({
  card,
  faceDown = false,
  highlighted = false,
  disabled = false,
  onPress,
}: Props) {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();

  if (faceDown) {
    return (
      <View
        style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
        accessibilityLabel={t("card.faceDown")}
        accessibilityRole="image"
      />
    );
  }

  const symbol = SUIT_SYMBOL[card.suit] ?? card.suit;
  const rankStr = rankDisplay(card.rank);
  const suitName = t(`card.suit.${card.suit}`);
  const isRed = RED_SUITS.has(card.suit);

  const label = highlighted
    ? t("card.highlighted", { rank: rankStr, suit: suitName })
    : t("card.label", { rank: rankStr, suit: suitName });

  const borderColor = highlighted ? colors.accent : colors.border;
  const rankColor = isRed ? colors.error : colors.text;

  const cardView = (
    <View
      style={[
        styles.card,
        { borderColor, backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 },
        highlighted && styles.highlighted,
      ]}
    >
      <Text style={[styles.rank, { color: rankColor }]}>{rankStr}</Text>
      <Text style={[styles.suit, { color: rankColor }]}>{symbol}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        {cardView}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={label} accessibilityRole="image">
      {cardView}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 52,
    height: 74,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    gap: 2,
  },
  highlighted: {
    borderWidth: 2,
  },
  rank: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  suit: {
    fontSize: 18,
    lineHeight: 22,
  },
});
