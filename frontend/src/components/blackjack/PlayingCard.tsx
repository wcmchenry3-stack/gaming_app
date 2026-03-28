import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { CardResponse } from "../../api/blackjackClient";

interface Props {
  card: CardResponse;
}

const RED_SUITS = new Set(["♥", "♦"]);

function suitKey(suit: string): string {
  const map: Record<string, string> = {
    "♠": "spades",
    "♥": "hearts",
    "♦": "diamonds",
    "♣": "clubs",
  };
  return map[suit] ?? suit;
}

export default function PlayingCard({ card }: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  if (card.face_down) {
    return (
      <View
        style={[styles.card, styles.faceDown, { borderColor: colors.border, backgroundColor: colors.surface }]}
        accessibilityLabel={t("card.faceDown")}
        accessibilityRole="image"
      >
        <Text style={[styles.backPattern, { color: colors.textMuted }]}>?</Text>
      </View>
    );
  }

  const suitName = t(`card.suit.${suitKey(card.suit)}`);
  const label = t("card.accessibilityLabel", { rank: card.rank, suit: suitName });
  const isRed = RED_SUITS.has(card.suit);
  const rankColor = isRed ? colors.error : colors.text;

  return (
    <View
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Text style={[styles.rank, { color: rankColor }]}>{card.rank}</Text>
      <Text style={[styles.suit, { color: rankColor }]}>{card.suit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 52,
    height: 72,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    gap: 2,
  },
  faceDown: {},
  backPattern: {
    fontSize: 24,
    fontWeight: "700",
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
