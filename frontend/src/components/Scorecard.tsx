import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import ScoreRow from "./ScoreRow";

const UPPER_CATEGORIES: { key: string; label: string }[] = [
  { key: "ones", label: "Ones" },
  { key: "twos", label: "Twos" },
  { key: "threes", label: "Threes" },
  { key: "fours", label: "Fours" },
  { key: "fives", label: "Fives" },
  { key: "sixes", label: "Sixes" },
];

const LOWER_CATEGORIES: { key: string; label: string }[] = [
  { key: "three_of_a_kind", label: "Three of a Kind" },
  { key: "four_of_a_kind", label: "Four of a Kind" },
  { key: "full_house", label: "Full House (25)" },
  { key: "small_straight", label: "Sm. Straight (30)" },
  { key: "large_straight", label: "Lg. Straight (40)" },
  { key: "yahtzee", label: "Yahtzee! (50)" },
  { key: "chance", label: "Chance" },
];

interface ScorecardProps {
  scores: Record<string, number | null>;
  possibleScores: Record<string, number>;
  rollsUsed: number;
  gameOver: boolean;
  upperSubtotal: number;
  upperBonus: number;
  totalScore: number;
  onScore: (category: string) => void;
}

export default function Scorecard({
  scores,
  possibleScores,
  rollsUsed,
  gameOver,
  upperSubtotal,
  upperBonus,
  totalScore,
  onScore,
}: ScorecardProps) {
  const canScore = rollsUsed > 0 && !gameOver;

  return (
    <ScrollView style={styles.container}>
      {/* Upper Section */}
      <Text style={styles.sectionHeader}>Upper Section</Text>
      {UPPER_CATEGORIES.map(({ key, label }) => (
        <ScoreRow
          key={key}
          label={label}
          score={scores[key]}
          potential={possibleScores[key]}
          canScore={canScore}
          onSelect={() => onScore(key)}
        />
      ))}
      <View style={styles.bonusRow}>
        <Text style={styles.bonusLabel}>Bonus (≥63 = +35)</Text>
        <Text style={styles.bonusValue}>
          {upperSubtotal} / 63{upperBonus > 0 ? " ✓" : ""}
        </Text>
      </View>

      {/* Lower Section */}
      <Text style={styles.sectionHeader}>Lower Section</Text>
      {LOWER_CATEGORIES.map(({ key, label }) => (
        <ScoreRow
          key={key}
          label={label}
          score={scores[key]}
          potential={possibleScores[key]}
          canScore={canScore}
          onSelect={() => onScore(key)}
        />
      ))}

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Score</Text>
        <Text style={styles.totalValue}>{totalScore}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    backgroundColor: "#1e293b",
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 6,
    letterSpacing: 0.5,
  },
  bonusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  bonusLabel: {
    fontSize: 13,
    color: "#475569",
    fontStyle: "italic",
  },
  bonusValue: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#facc15",
  },
});
