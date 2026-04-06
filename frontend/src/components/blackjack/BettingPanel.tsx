import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { GameRules } from "../../game/blackjack/types";

const MIN_BET = 10;
const MAX_BET = 500;
const STEP = 10;

interface Props {
  chips: number;
  onDeal: (amount: number) => void;
  loading: boolean;
  error: string | null;
  rules: GameRules;
  onRulesChange: (rules: GameRules) => void;
}

export default function BettingPanel({
  chips,
  onDeal,
  loading,
  error,
  rules,
  onRulesChange,
}: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();
  const maxBet = Math.min(MAX_BET, chips);
  const [bet, setBet] = useState<number>(Math.min(100, maxBet));
  const [rulesOpen, setRulesOpen] = useState(false);

  function decrease() {
    setBet((b) => Math.max(MIN_BET, b - STEP));
  }

  function increase() {
    setBet((b) => Math.min(maxBet, b + STEP));
  }

  const canDeal = bet >= MIN_BET && bet <= maxBet && !loading;

  return (
    <View style={styles.container}>
      <Text
        style={[styles.chips, { color: colors.text }]}
        accessibilityLabel={t("chips.accessibilityLabel", { chips })}
      >
        {t("chips.display", { chips })}
      </Text>

      <Text style={[styles.betLabel, { color: colors.textMuted }]}>{t("bet.label")}</Text>

      <View style={styles.stepper}>
        <Pressable
          style={[styles.stepBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={decrease}
          disabled={bet <= MIN_BET || loading}
          accessibilityRole="button"
          accessibilityLabel={t("bet.decreaseLabel")}
          accessibilityState={{ disabled: bet <= MIN_BET || loading }}
        >
          <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
        </Pressable>

        <Text
          style={[styles.betAmount, { color: colors.text }]}
          accessibilityLabel={t("bet.accessibilityLabel", { amount: bet })}
        >
          {t("chips.display", { chips: bet })}
        </Text>

        <Pressable
          style={[styles.stepBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={increase}
          disabled={bet >= maxBet || loading}
          accessibilityRole="button"
          accessibilityLabel={t("bet.increaseLabel")}
          accessibilityState={{ disabled: bet >= maxBet || loading }}
        >
          <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.dealBtn, { backgroundColor: canDeal ? colors.accent : colors.border }]}
        onPress={() => onDeal(bet)}
        disabled={!canDeal}
        accessibilityRole="button"
        accessibilityLabel={t("actions.dealLabel", { amount: bet })}
        accessibilityState={{ disabled: !canDeal, busy: loading }}
      >
        <Text style={[styles.dealBtnText, { color: colors.surface }]}>{t("actions.deal")}</Text>
      </Pressable>

      {/* Collapsible Table Rules */}
      <Pressable
        style={styles.rulesToggle}
        onPress={() => setRulesOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={t("rules.toggleLabel")}
      >
        <Text style={[styles.rulesToggleText, { color: colors.textMuted }]}>
          {rulesOpen ? "▾" : "▸"} {t("rules.title")}
        </Text>
      </Pressable>

      {rulesOpen && (
        <View style={[styles.rulesPanel, { borderColor: colors.border }]}>
          {/* H17 toggle */}
          <View style={styles.ruleRow}>
            <Text style={[styles.ruleLabel, { color: colors.text }]}>
              {t("rules.dealerSoft17")}
            </Text>
            <View style={styles.ruleOptions}>
              <Pressable
                style={[
                  styles.ruleOptionBtn,
                  {
                    backgroundColor: !rules.hit_soft_17 ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => onRulesChange({ ...rules, hit_soft_17: false })}
                accessibilityRole="button"
                accessibilityLabel={t("rules.s17Label")}
              >
                <Text
                  style={[
                    styles.ruleOptionText,
                    { color: !rules.hit_soft_17 ? colors.surface : colors.text },
                  ]}
                >
                  {t("rules.s17")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.ruleOptionBtn,
                  {
                    backgroundColor: rules.hit_soft_17 ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => onRulesChange({ ...rules, hit_soft_17: true })}
                accessibilityRole="button"
                accessibilityLabel={t("rules.h17Label")}
              >
                <Text
                  style={[
                    styles.ruleOptionText,
                    { color: rules.hit_soft_17 ? colors.surface : colors.text },
                  ]}
                >
                  {t("rules.h17")}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Deck count */}
          <View style={styles.ruleRow}>
            <Text style={[styles.ruleLabel, { color: colors.text }]}>{t("rules.deckCount")}</Text>
            <View style={styles.stepper}>
              <Pressable
                style={[
                  styles.ruleStepBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() =>
                  onRulesChange({ ...rules, deck_count: Math.max(1, rules.deck_count - 1) })
                }
                disabled={rules.deck_count <= 1}
                accessibilityRole="button"
                accessibilityLabel={t("rules.decreaseDeckLabel")}
              >
                <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
              </Pressable>
              <Text style={[styles.ruleValue, { color: colors.text }]}>{rules.deck_count}</Text>
              <Pressable
                style={[
                  styles.ruleStepBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() =>
                  onRulesChange({ ...rules, deck_count: Math.min(8, rules.deck_count + 1) })
                }
                disabled={rules.deck_count >= 8}
                accessibilityRole="button"
                accessibilityLabel={t("rules.increaseDeckLabel")}
              >
                <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Penetration */}
          <View style={styles.ruleRow}>
            <Text style={[styles.ruleLabel, { color: colors.text }]}>{t("rules.penetration")}</Text>
            <View style={styles.stepper}>
              <Pressable
                style={[
                  styles.ruleStepBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() =>
                  onRulesChange({
                    ...rules,
                    penetration: Math.max(0.5, Math.round((rules.penetration - 0.05) * 100) / 100),
                  })
                }
                disabled={rules.penetration <= 0.5}
                accessibilityRole="button"
                accessibilityLabel={t("rules.decreasePenetrationLabel")}
              >
                <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
              </Pressable>
              <Text style={[styles.ruleValue, { color: colors.text }]}>
                {Math.round(rules.penetration * 100)}%
              </Text>
              <Pressable
                style={[
                  styles.ruleStepBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() =>
                  onRulesChange({
                    ...rules,
                    penetration: Math.min(0.9, Math.round((rules.penetration + 0.05) * 100) / 100),
                  })
                }
                disabled={rules.penetration >= 0.9}
                accessibilityRole="button"
                accessibilityLabel={t("rules.increasePenetrationLabel")}
              >
                <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 320,
  },
  chips: {
    fontSize: 24,
    fontWeight: "700",
  },
  betLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "600",
  },
  betAmount: {
    fontSize: 20,
    fontWeight: "700",
    minWidth: 100,
    textAlign: "center",
  },
  dealBtn: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  dealBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    textAlign: "center",
  },
  rulesToggle: {
    paddingVertical: 4,
  },
  rulesToggleText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rulesPanel: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ruleLabel: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  ruleOptions: {
    flexDirection: "row",
    gap: 6,
  },
  ruleOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  ruleOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ruleStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleValue: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center",
  },
});
