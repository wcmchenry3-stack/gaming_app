import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

const DIE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

interface Props {
  value: number | null;
  extraTurn?: boolean;
}

export default function DiceDisplay({ value, extraTurn }: Props) {
  const { t } = useTranslation("pachisi");
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text
        style={[styles.face, { color: colors.text }]}
        accessibilityLabel={value != null ? t("die.value", { value }) : undefined}
      >
        {value != null ? DIE_FACES[value - 1] : "?"}
      </Text>
      {extraTurn && (
        <Text style={[styles.badge, { color: colors.accent }]}>{t("die.extraTurn")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  face: {
    fontSize: 56,
    lineHeight: 64,
  },
  badge: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
