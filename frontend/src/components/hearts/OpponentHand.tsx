import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import PlayingCard from "./PlayingCard";
import type { Card, Rank, Suit } from "../../game/hearts/types";

interface Props {
  cardCount: number;
  label: string;
  score?: number;
}

const PLACEHOLDER_CARD: Card = { suit: "spades" as Suit, rank: 2 as Rank };

export default function OpponentHand({ cardCount, label, score }: Props) {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();

  return (
    <View
      style={styles.container}
      accessibilityLabel={t("hand.opponent", { label, count: cardCount })}
      accessibilityRole="none"
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      {score !== undefined && <Text style={[styles.score, { color: colors.text }]}>{score}</Text>}
      <View style={styles.cards}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <PlayingCard key={i} card={PLACEHOLDER_CARD} faceDown />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  score: {
    fontSize: 13,
    fontWeight: "700",
  },
  cards: {
    flexDirection: "row",
  },
});
