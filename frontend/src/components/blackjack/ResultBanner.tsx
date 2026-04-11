import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  outcome: string;
  payout: number;
}

export default function ResultBanner({ outcome, payout }: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  const outcomeKey = `outcome.${outcome}` as const;
  const outcomeText = t(outcomeKey as Parameters<typeof t>[0]);

  // Per-outcome accent color: blackjack=tertiary lime, win=bonus green,
  // lose=error red, push=textMuted
  let accentColor: string;
  switch (outcome) {
    case "blackjack":
      accentColor = colors.tertiary;
      break;
    case "win":
      accentColor = colors.bonus;
      break;
    case "lose":
      accentColor = colors.error;
      break;
    default: // push
      accentColor = colors.textMuted;
  }

  let payoutText: string;
  let payoutColor: string;
  if (payout > 0) {
    payoutText = t("payout.positive", { amount: payout });
    payoutColor = colors.bonus;
  } else if (payout < 0) {
    payoutText = t("payout.negative", { amount: payout });
    payoutColor = colors.error;
  } else {
    payoutText = t("payout.zero");
    payoutColor = colors.textMuted;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceHigh,
          borderColor: colors.border,
          borderTopColor: accentColor,
        },
      ]}
    >
      <Text style={[styles.outcome, { color: accentColor }]}>{outcomeText}</Text>
      <Text
        style={[styles.payout, { color: payoutColor }]}
        accessibilityLabel={t("payout.accessibilityLabel", { amount: payout })}
      >
        {payoutText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderTopWidth: 4,
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 6,
  },
  outcome: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  payout: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
});
