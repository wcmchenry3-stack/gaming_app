import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  playerLabels: string[];
  cumulativeScores: number[];
  /** Per-round history: scoreHistory[roundIndex][playerIndex] = points that round. */
  scoreHistory: number[][];
  dangerIndex?: number | null;
}

export default function ScoreBoard({
  playerLabels,
  cumulativeScores,
  scoreHistory,
  dangerIndex,
}: Props) {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();

  // Leading player = lowest cumulative score (Hearts: low is good)
  const leadIndex = cumulativeScores.reduce(
    (minIdx, s, i, arr) => (s < (arr[minIdx] ?? Infinity) ? i : minIdx),
    0
  );

  function playerColor(i: number): string {
    if (dangerIndex !== null && dangerIndex !== undefined && dangerIndex === i) return colors.error;
    if (i === leadIndex) return colors.accent;
    return colors.text;
  }

  // Abbreviate player label to 4 chars to fit 4 columns at phone width
  function abbrev(label: string): string {
    return label.length > 5 ? label.slice(0, 4) + "…" : label;
  }

  return (
    <View
      style={[styles.table, { borderColor: colors.border }]}
      accessibilityLabel={t("score.board")}
      accessibilityRole="none"
    >
      {/* Header row */}
      <View style={[styles.row, styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.roundCell, styles.headerText, { color: colors.textMuted }]}>
          {t("score.round")}
        </Text>
        {playerLabels.map((label, i) => (
          <Text key={i} style={[styles.cell, styles.headerText, { color: playerColor(i) }]}>
            {abbrev(label)}
          </Text>
        ))}
      </View>

      {/* Per-round rows */}
      <ScrollView style={styles.historyScroll} nestedScrollEnabled>
        {scoreHistory.map((roundScores, round) => (
          <View
            key={round}
            style={[styles.row, round % 2 === 1 && { backgroundColor: colors.surfaceAlt + "44" }]}
          >
            <Text style={[styles.roundCell, { color: colors.textMuted }]}>{round + 1}</Text>
            {playerLabels.map((_, i) => (
              <Text key={i} style={[styles.cell, { color: playerColor(i) }]}>
                {roundScores[i] ?? 0}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Total row */}
      <View style={[styles.row, styles.totalRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.roundCell, styles.totalText, { color: colors.textMuted }]}>
          {t("score.total")}
        </Text>
        {cumulativeScores.map((score, i) => (
          <Text key={i} style={[styles.cell, styles.totalText, { color: playerColor(i) }]}>
            {score}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    borderBottomWidth: 1,
  },
  totalRow: {
    borderTopWidth: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  totalText: {
    fontWeight: "700",
    fontSize: 13,
  },
  roundCell: {
    width: 32,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: "center",
  },
  cell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  historyScroll: {
    maxHeight: 180,
  },
});
