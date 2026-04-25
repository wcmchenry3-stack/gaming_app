import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export interface StatCard {
  key: string;
  label: string;
  value: string;
  accent?: boolean;
}

interface Props {
  heroLabel: string;
  heroValue: string;
  heroValueColor?: string;
  heroSub: string;
  cards: readonly StatCard[];
}

export default function HeroStatScoreboard({
  heroLabel,
  heroValue,
  heroValueColor,
  heroSub,
  cards,
}: Props) {
  const { colors } = useTheme();
  const valueColor = heroValueColor ?? colors.text;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{heroLabel}</Text>
        <Text style={[styles.heroValue, { color: valueColor }]}>{heroValue}</Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>{heroSub}</Text>
      </View>
      <View style={styles.grid}>
        {cards.map((card) => (
          <View
            key={card.key}
            style={[
              styles.card,
              {
                borderColor: card.accent ? colors.accent : colors.border,
                backgroundColor: card.accent ? colors.surfaceAlt : "transparent",
              },
            ]}
            accessibilityLabel={`${card.label}: ${card.value}`}
            accessibilityRole="none"
          >
            <Text style={[styles.cardValue, { color: colors.text }]}>{card.value}</Text>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{card.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 16,
  },
  hero: {
    alignItems: "center",
    gap: 4,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroValue: {
    fontSize: 30,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  heroSub: {
    fontSize: 13,
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  card: {
    flexBasis: "46%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
    minWidth: 90,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
