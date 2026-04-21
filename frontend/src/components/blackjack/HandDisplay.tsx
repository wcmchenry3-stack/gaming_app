import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { HandResponse } from "../../game/blackjack/types";
import PlayingCard from "./PlayingCard";
import ScorePill from "./ScorePill";

interface Props {
  hand: HandResponse;
  label: string;
  concealed?: boolean;
  /** "player" renders larger cards with fan rotation and neon score pill;
   *  "dealer" renders compact cards and glass badge score. */
  variant?: "player" | "dealer";
  /** Shrink cards for constrained layouts — used by split-hand side-by-side
   *  rendering and by the whole table on short-height viewports. Shrinks
   *  both the "player" and "dealer" variants when set. */
  compact?: boolean;
  /**
   * When set, cards with count > 2 switch from wrap to a fan/overlap layout
   * that constrains the row to this pixel width. Each card after the first
   * shifts left so the rank+suit pip of earlier cards peeks out on the left.
   * Pass the available inner width of the containing column.
   */
  fanMaxWidth?: number;
}

// First two player cards get a gentle fan tilt
const PLAYER_ROTATIONS: Record<number, number> = { 0: -3, 1: 2 };

function computeOverlap(cardCount: number, cardWidth: number, maxWidth: number): number {
  if (cardCount <= 2 || cardWidth * cardCount <= maxWidth) return 0;
  // total = cardWidth + (n-1) × (cardWidth - overlap) ≤ maxWidth
  // → overlap = cardWidth - (maxWidth - cardWidth) / (n - 1)
  return Math.max(0, Math.ceil(cardWidth - (maxWidth - cardWidth) / (cardCount - 1)));
}

export default function HandDisplay({
  hand,
  label,
  concealed = false,
  variant = "dealer",
  compact = false,
  fanMaxWidth,
}: Props) {
  const { colors } = useTheme();
  const showScore = hand.cards.length > 0;

  // Card width matches blackjack PlayingCard cardSize() values.
  const cardWidth = variant === "player" ? (compact ? 48 : 68) : compact ? 40 : 52;
  const isFan = fanMaxWidth !== undefined && hand.cards.length > 2;
  const overlapPx = isFan ? computeOverlap(hand.cards.length, cardWidth, fanMaxWidth!) : 0;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact, { color: colors.textMuted }]}>
        {label}
      </Text>

      <View style={isFan ? styles.cardsFan : styles.cards}>
        {hand.cards.map((card, i) => (
          <View
            key={i}
            style={isFan ? { marginLeft: i > 0 ? -overlapPx : 0, zIndex: i } : undefined}
          >
            <PlayingCard
              card={card}
              variant={variant}
              compact={compact}
              rotation={variant === "player" ? (PLAYER_ROTATIONS[i] ?? 0) : 0}
            />
          </View>
        ))}
      </View>

      {showScore && (
        <ScorePill value={hand.value} soft={hand.soft} concealed={concealed} variant={variant} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  containerCompact: {
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  labelCompact: {
    fontSize: 11,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  cardsFan: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
  },
});
