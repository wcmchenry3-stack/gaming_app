import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FruitDefinition } from "../../theme/fruitSets";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  current: FruitDefinition;
  next: FruitDefinition;
}

export default function NextFruitPreview({ current, next }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.label}>Drop</Text>
        <Text style={styles.emoji}>{current.emoji}</Text>
        <Text style={[styles.name, { color: colors.text }]}>{current.name}</Text>
      </View>
      <View style={[styles.card, styles.nextCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Text style={styles.label}>Next</Text>
        <Text style={[styles.emoji, styles.nextEmoji]}>{next.emoji}</Text>
        <Text style={[styles.name, { color: colors.textMuted }]}>{next.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginBottom: 12,
  },
  card: {
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  nextCard: {
    opacity: 0.75,
  },
  label: {
    fontSize: 10,
    color: "#94a3b8",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emoji: {
    fontSize: 32,
  },
  nextEmoji: {
    fontSize: 22,
  },
  name: {
    fontSize: 11,
    marginTop: 2,
  },
});
