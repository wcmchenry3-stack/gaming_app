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
}

// First two player cards get a gentle fan tilt
const PLAYER_ROTATIONS: Record<number, number> = { 0: -3, 1: 2 };

export default function HandDisplay({
  hand,
  label,
  concealed = false,
  variant = "dealer",
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const showScore = hand.cards.length > 0;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text
        style={[styles.label, compact && styles.labelCompact, { color: colors.textMuted }]}
      >
        {label}
      </Text>

      <View style={styles.cards}>
        {hand.cards.map((card, i) => (
          <PlayingCard
            key={i}
            card={card}
            variant={variant}
            compact={compact}
            rotation={variant === "player" ? (PLAYER_ROTATIONS[i] ?? 0) : 0}
          />
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
});
