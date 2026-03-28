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
    <View style={styles.container}>
      <Text style={[styles.outcome, { color: colors.text }]}>{outcomeText}</Text>
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
    alignItems: "center",
    gap: 6,
  },
  outcome: {
    fontSize: 28,
    fontWeight: "800",
  },
  payout: {
    fontSize: 20,
    fontWeight: "700",
  },
});
