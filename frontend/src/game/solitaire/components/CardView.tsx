/**
 * Solitaire CardView (#595).
 *
 * Stateless visual. Renders a single card in one of three visual states:
 * face-up (rank + suit symbol, color varies by suit), face-down (solid
 * placeholder), or selected (accent border — used when tap-to-select is
 * active). All colors come from `useTheme()`; no hardcoded hex.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../../theme/ThemeContext";
import type { Card, Suit } from "../types";
import { cardColor } from "../types";

const RANK_LABEL: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export interface CardViewProps {
  /** Card to render. Pass the card's own `faceUp` to control orientation. */
  readonly card: Card;
  /** Draws an accent-colored border. Used when the card is tap-selected. */
  readonly selected?: boolean;
  /** Optional press handler — when provided, the card is wrapped in a
   * `Pressable` with `accessibilityRole="button"` instead of the default
   * `"image"` so screen readers announce it as actionable. */
  readonly onPress?: () => void;
}

export default function CardView({ card, selected = false, onPress }: CardViewProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("solitaire");

  const borderColor = selected ? colors.accent : colors.border;
  const borderWidth = selected ? 2 : 1;
  const faceUpBg = colors.surface;
  const faceDownBg = colors.surfaceAlt;

  const containerStyle: ViewStyle = {
    ...styles.card,
    borderColor,
    borderWidth,
    backgroundColor: card.faceUp ? faceUpBg : faceDownBg,
  };

  if (!card.faceUp) {
    return (
      <Wrapper
        onPress={onPress}
        label={selected ? t("card.faceDownSelected") : t("card.faceDown")}
        style={containerStyle}
      >
        {null}
      </Wrapper>
    );
  }

  const suitSymbol = SUIT_SYMBOL[card.suit];
  const rank = rankLabel(card.rank);
  const textColor = cardColor(card) === "red" ? colors.error : colors.text;
  const suitName = t(`suit.${card.suit}` as const);
  const label = selected
    ? t("card.faceUpSelected", { rank, suit: suitName })
    : t("card.faceUp", { rank, suit: suitName });

  return (
    <Wrapper onPress={onPress} label={label} style={containerStyle}>
      <Text style={[styles.rank, { color: textColor }]}>{rank}</Text>
      <Text style={[styles.suit, { color: textColor }]}>{suitSymbol}</Text>
    </Wrapper>
  );
}

/** Chooses between Pressable (when `onPress`) and View — keeps a11y role
 * semantics correct. */
function Wrapper({
  onPress,
  label,
  style,
  children,
}: {
  readonly onPress?: () => void;
  readonly label: string;
  readonly style: ViewStyle;
  readonly children: React.ReactNode;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={style} accessibilityRole="image" accessibilityLabel={label}>
      {children}
    </View>
  );
}

export const CARD_WIDTH = 52;
export const CARD_HEIGHT = 72;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  rank: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  suit: {
    fontSize: 20,
    lineHeight: 24,
  },
});
