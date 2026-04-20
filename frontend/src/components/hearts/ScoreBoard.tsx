import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  playerLabels: string[];
  cumulativeScores: number[];
  handScores: number[];
  dangerIndex?: number | null;
}

export default function ScoreBoard({
  playerLabels,
  cumulativeScores,
  handScores,
  dangerIndex,
}: Props) {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();

  return (
    <View
      style={[styles.table, { borderColor: colors.border }]}
      accessibilityLabel={t("score.board")}
      accessibilityRole="none"
    >
      <View style={[styles.row, styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.cell, styles.headerText, { color: colors.textMuted }]}>
          {t("score.player")}
        </Text>
        <Text style={[styles.cell, styles.headerText, { color: colors.textMuted }]}>
          {t("score.total")}
        </Text>
        <Text style={[styles.cell, styles.headerText, { color: colors.textMuted }]}>
          {t("score.hand")}
        </Text>
      </View>
      {playerLabels.map((label, i) => {
        const isDanger = dangerIndex !== null && dangerIndex !== undefined && dangerIndex === i;
        const scoreColor = isDanger ? colors.error : colors.text;
        const cumulative = cumulativeScores[i] ?? 0;
        const hand = handScores[i] ?? 0;
        return (
          <View key={i} style={styles.row}>
            <Text style={[styles.cell, { color: scoreColor }]}>{label}</Text>
            <Text style={[styles.cell, { color: scoreColor }]}>{cumulative}</Text>
            <Text style={[styles.cell, { color: scoreColor }]}>{hand > 0 ? `+${hand}` : hand}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
  },
  header: {
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: "500",
  },
});
