import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";

interface ScoreRowProps {
  label: string;
  score: number | null;
  potential: number | undefined;
  onSelect: () => void;
  canScore: boolean;
}

export default function ScoreRow({ label, score, potential, onSelect, canScore }: ScoreRowProps) {
  const { t } = useTranslation("yahtzee");
  const { colors } = useTheme();
  const isFilled = score !== null;
  const isSelectable = !isFilled && canScore;

  const stateText = isFilled
    ? t("score.scored", { score })
    : canScore && potential !== undefined
      ? t("score.potential", { potential })
      : t("score.notAvailable");
  const accessLabel = t("score.label", { category: label, state: stateText });

  return (
    <Pressable
      style={[
        styles.row,
        {
          backgroundColor: isFilled ? colors.surfaceAlt : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={isSelectable ? onSelect : undefined}
      disabled={!isSelectable}
      accessibilityRole="button"
      accessibilityLabel={accessLabel}
      accessibilityState={{ disabled: !isSelectable }}
    >
      <Text style={[styles.label, { color: isFilled ? colors.textFilled : colors.text }]}>
        {label}
      </Text>
      <View style={styles.scoreBox}>
        {isFilled ? (
          <Text style={[styles.score, { color: colors.textFilled }]}>{score}</Text>
        ) : canScore && potential !== undefined ? (
          <Text style={[styles.potential, { color: colors.accent }]}>{potential}</Text>
        ) : (
          <Text style={[styles.dash, { color: colors.border }]}>—</Text>
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
    minHeight: 44,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 14,
    flex: 1,
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
  },
  dash: {
    fontSize: 14,
  },
});
