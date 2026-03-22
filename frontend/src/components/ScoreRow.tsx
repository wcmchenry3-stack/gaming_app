import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";

interface ScoreRowProps {
  label: string;
  score: number | null;
  potential: number | undefined;
  onSelect: () => void;
  canScore: boolean; // true when rolls_used > 0 and not game_over
}

export default function ScoreRow({ label, score, potential, onSelect, canScore }: ScoreRowProps) {
  const isFilled = score !== null;
  const isSelectable = !isFilled && canScore;

  return (
    <Pressable
      style={[styles.row, isFilled && styles.filledRow]}
      onPress={isSelectable ? onSelect : undefined}
      disabled={!isSelectable}
    >
      <Text style={[styles.label, isFilled && styles.filledText]}>{label}</Text>
      <View style={styles.scoreBox}>
        {isFilled ? (
          <Text style={[styles.score, styles.filledText]}>{score}</Text>
        ) : canScore && potential !== undefined ? (
          <Text style={styles.potential}>{potential}</Text>
        ) : (
          <Text style={styles.dash}>—</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  filledRow: {
    backgroundColor: "#f8fafc",
  },
  label: {
    fontSize: 14,
    color: "#1e293b",
    flex: 1,
  },
  filledText: {
    color: "#94a3b8",
  },
  scoreBox: {
    width: 44,
    alignItems: "flex-end",
  },
  score: {
    fontSize: 14,
    fontWeight: "600",
  },
  potential: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  dash: {
    fontSize: 14,
    color: "#cbd5e1",
  },
});
