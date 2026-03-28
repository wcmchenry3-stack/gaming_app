import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

const MIN_BET = 10;
const MAX_BET = 500;
const STEP = 10;

interface Props {
  chips: number;
  onDeal: (amount: number) => void;
  loading: boolean;
  error: string | null;
}

export default function BettingPanel({ chips, onDeal, loading, error }: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();
  const maxBet = Math.min(MAX_BET, chips);
  const [bet, setBet] = useState<number>(Math.min(100, maxBet));

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
});
