import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { HandResponse } from "../../game/blackjack/types";
import PlayingCard from "./PlayingCard";

interface Props {
  hand: HandResponse;
  label: string;
  concealed?: boolean; // true when dealer hole card is hidden
}

export default function HandDisplay({ hand, label, concealed = false }: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  const valueText = concealed
    ? t("hand.valueHidden")
    : hand.soft
      ? t("hand.softValue" as Parameters<typeof t>[0], { value: hand.value })
      : t("hand.value", { value: hand.value });

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.cards}>
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} />
        ))}
      </View>
      {hand.cards.length > 0 && (
        <Text style={[styles.value, { color: colors.text }]}>{valueText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
  },
});
