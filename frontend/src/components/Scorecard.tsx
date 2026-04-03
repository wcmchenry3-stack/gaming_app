import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import ScoreRow from "./ScoreRow";
import { useTheme } from "../theme/ThemeContext";

const UPPER_CATEGORY_KEYS = ["ones", "twos", "threes", "fours", "fives", "sixes"] as const;
const LOWER_CATEGORY_KEYS = [
  "three_of_a_kind",
  "four_of_a_kind",
  "full_house",
  "small_straight",
  "large_straight",
  "yacht",
  "chance",
] as const;

// Map backend snake_case keys → i18n camelCase keys
const CATEGORY_I18N_KEY: Record<string, string> = {
  ones: "category.ones",
  twos: "category.twos",
  threes: "category.threes",
  fours: "category.fours",
  fives: "category.fives",
  sixes: "category.sixes",
  three_of_a_kind: "category.threeOfAKind",
  four_of_a_kind: "category.fourOfAKind",
  full_house: "category.fullHouse",
  small_straight: "category.smallStraight",
  large_straight: "category.largeStraight",
  yacht: "category.yacht",
  chance: "category.chance",
};

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
  const { t } = useTranslation("yacht");
  const { colors } = useTheme();
  const canScore = rollsUsed > 0 && !gameOver;

  return (
    <ScrollView focusable style={[styles.container, { borderColor: colors.border }]}>
      <Text style={[styles.sectionHeader, { backgroundColor: colors.sectionHeaderBg }]}>
        {t("section.upper")}
      </Text>
      {UPPER_CATEGORY_KEYS.map((key) => (
        <ScoreRow
          key={key}
          label={t(CATEGORY_I18N_KEY[key])}
          score={scores[key]}
          potential={possibleScores[key]}
          canScore={canScore}
          onSelect={() => onScore(key)}
        />
      ))}
      <View
        style={[
          styles.bonusRow,
          { backgroundColor: colors.bonusBg, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.bonusLabel, { color: colors.textMuted }]}>{t("bonus.label")}</Text>
        <Text style={[styles.bonusValue, { color: colors.textMuted }]}>
          {upperBonus > 0
            ? t("bonus.achieved", { subtotal: upperSubtotal })
            : t("bonus.progress", { subtotal: upperSubtotal })}
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { backgroundColor: colors.sectionHeaderBg }]}>
        {t("section.lower")}
      </Text>
      {LOWER_CATEGORY_KEYS.map((key) => (
        <ScoreRow
          key={key}
          label={t(CATEGORY_I18N_KEY[key])}
          score={scores[key]}
          potential={possibleScores[key]}
          canScore={canScore}
          onSelect={() => onScore(key)}
        />
      ))}

      <View style={[styles.totalRow, { backgroundColor: colors.totalBg }]}>
        <Text style={styles.totalLabel}>{t("section.total")}</Text>
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
  },
  sectionHeader: {
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
    borderBottomWidth: 1,
  },
  bonusLabel: {
    fontSize: 13,
    fontStyle: "italic",
  },
  bonusValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
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
