import React from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Platform } from "react-native";
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

// 600dp catches tablets, Galaxy Fold unfolded (both orientations), and other
// wide-aspect devices where showing the upper and lower sections side-by-side
// eliminates the need to scroll within the scorecard. Phones in portrait
// (iPhone ~390dp, typical Android ~410dp) remain below this and keep the
// single-column stacked layout.
const WIDE_BREAKPOINT = 600;

interface ScorecardProps {
  scores: Record<string, number | null>;
  possibleScores: Record<string, number>;
  rollsUsed: number;
  gameOver: boolean;
  upperSubtotal: number;
  upperBonus: number;
  yachtBonusCount: number;
  yachtBonusTotal: number;
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
  yachtBonusCount,
  yachtBonusTotal,
  totalScore,
  onScore,
}: ScorecardProps) {
  const { t } = useTranslation("yacht");
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const canScore = rollsUsed > 0 && !gameOver;

  const upperBento = (
    <View
      style={[
        styles.bento,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          borderTopColor: colors.accent,
        },
      ]}
    >
      <View style={styles.bentoHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t("section.upper")}</Text>
        <View
          style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.accent }]}
        >
          <Text style={[styles.badgeText, { color: colors.accent }]}>{t("bonus.badge")}</Text>
        </View>
      </View>
      {UPPER_CATEGORY_KEYS.map((key) => (
        <ScoreRow
          key={key}
          category={key}
          tone="upper"
          label={t(CATEGORY_I18N_KEY[key] ?? "")}
          score={scores[key] ?? null}
          potential={possibleScores[key]}
          canScore={canScore}
          onSelect={() => onScore(key)}
        />
      ))}
      <View style={[styles.bonusRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.bonusLabel, { color: colors.textMuted }]}>{t("bonus.label")}</Text>
        <Text
          style={[styles.bonusValue, { color: upperBonus > 0 ? colors.bonus : colors.textMuted }]}
        >
          {upperBonus > 0
            ? t("bonus.achieved", { subtotal: upperSubtotal })
            : t("bonus.progress", { subtotal: upperSubtotal })}
        </Text>
      </View>
    </View>
  );

  const lowerBento = (
    <View
      style={[
        styles.bento,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          borderTopColor: colors.secondary,
        },
      ]}
    >
      <View style={styles.bentoHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t("section.lower")}</Text>
      </View>
      {LOWER_CATEGORY_KEYS.map((key) => (
        <ScoreRow
          key={key}
          category={key}
          tone="lower"
          label={t(CATEGORY_I18N_KEY[key] ?? "")}
          score={scores[key] ?? null}
          potential={possibleScores[key]}
          canScore={canScore}
          onSelect={() => onScore(key)}
        />
      ))}
      {yachtBonusCount > 0 && (
        <View style={[styles.bonusRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.bonusLabel, { color: colors.textMuted }]}>
            {t("bonus.yachtLabel")}
          </Text>
          <Text style={[styles.bonusValue, { color: colors.bonus }]}>
            {t("bonus.yachtValue", { count: yachtBonusCount, total: yachtBonusTotal })}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      // focusable on web adds a tabIndex so axe's scrollable-region-focusable
      // rule is satisfied and keyboard users can tab into the scorecard.
      // Omitted on native — on iOS it interferes with nested scroll gestures
      // and made the scorecard frozen (#454).
      focusable={Platform.OS === "web"}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.grid, isWide && styles.gridWide]}>
        <View style={isWide ? styles.col : undefined}>{upperBento}</View>
        <View style={isWide ? styles.col : undefined}>{lowerBento}</View>
      </View>
      <View
        style={[
          styles.totalRow,
          { backgroundColor: colors.surfaceHigh, borderColor: colors.accent },
        ]}
      >
        <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t("section.total")}</Text>
        <Text style={[styles.totalValue, { color: colors.accent }]}>{totalScore}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  grid: {
    flexDirection: "column",
    gap: 12,
  },
  gridWide: {
    flexDirection: "row",
  },
  col: {
    flex: 1,
  },
  bento: {
    borderRadius: 14,
    borderWidth: 1,
    borderTopWidth: 2,
    padding: 12,
  },
  bentoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bonusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 4,
    marginTop: 2,
    borderTopWidth: 1,
  },
  bonusLabel: {
    fontSize: 12,
    fontStyle: "italic",
  },
  bonusValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "900",
  },
});
