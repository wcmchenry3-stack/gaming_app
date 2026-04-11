import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { CardResponse } from "../../game/blackjack/types";

interface Props {
  card: CardResponse;
  /** Clockwise rotation in degrees — used for the player-hand card fan. */
  rotation?: number;
  /** "player" renders a larger card; "dealer" renders the compact default. */
  variant?: "player" | "dealer";
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

export default function PlayingCard({ card, rotation = 0, variant = "dealer" }: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  const cardSizeStyle = variant === "player" ? styles.cardPlayer : styles.cardDealer;
  const rankSizeStyle = variant === "player" ? styles.rankPlayer : styles.rankDealer;
  const suitSizeStyle = variant === "player" ? styles.suitPlayer : styles.suitDealer;
  const rotateStyle = rotation !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined;

  if (card.face_down) {
    return (
      <View
        style={[
          styles.card,
          cardSizeStyle,
          { borderColor: colors.secondary, backgroundColor: colors.surface },
          rotateStyle,
        ]}
        accessibilityLabel={t("card.faceDown")}
        accessibilityRole="image"
      >
        <View style={[styles.cardBackInner, { borderColor: colors.secondary }]}>
          <Text style={[styles.backPattern, { color: colors.secondary }]}>?</Text>
        </View>
      </View>
    );
  }

  const suitName = t(`card.suit.${suitKey(card.suit)}`);
  const label = t("card.accessibilityLabel", { rank: card.rank, suit: suitName });
  const isRed = RED_SUITS.has(card.suit);
  const rankColor = isRed ? colors.error : colors.text;

  return (
    <View
      style={[
        styles.card,
        cardSizeStyle,
        { borderColor: colors.border, backgroundColor: colors.surface },
        rotateStyle,
      ]}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Text style={[rankSizeStyle, { color: rankColor }]}>{card.rank}</Text>
      <Text style={[suitSizeStyle, { color: rankColor }]}>{card.suit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    gap: 2,
  },
  cardDealer: {
    width: 52,
    height: 72,
  },
  cardPlayer: {
    width: 68,
    height: 96,
  },
  cardBackInner: {
    width: "70%",
    height: "70%",
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backPattern: {
    fontSize: 22,
    fontWeight: "700",
  },
  rankDealer: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  rankPlayer: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  suitDealer: {
    fontSize: 18,
    lineHeight: 22,
  },
  suitPlayer: {
    fontSize: 22,
    lineHeight: 26,
  },
});
