import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { FruitDefinition } from "../../theme/fruitSets";
import { useTheme } from "../../theme/ThemeContext";
import FruitGlyph from "./FruitGlyph";

interface Props {
  current: FruitDefinition;
  next: FruitDefinition;
}

export default function NextFruitPreview({ current, next }: Props) {
  const { t } = useTranslation("fruit-merge");
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessible
        accessibilityLabel={t("preview.droppingNext", { name: current.name })}
      >
        <Text style={styles.label} importantForAccessibility="no">
          {t("preview.dropLabel")}
        </Text>
        <FruitGlyph fruit={current} size={styles.emoji.fontSize} />
        <Text style={[styles.name, { color: colors.text }]} importantForAccessibility="no">
          {current.name}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          styles.nextCard,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
        accessible
        accessibilityLabel={t("preview.comingUp", { name: next.name })}
      >
        <Text style={styles.label} importantForAccessibility="no">
          {t("preview.nextLabel")}
        </Text>
        <FruitGlyph fruit={next} size={styles.nextEmoji.fontSize} />
        <Text style={[styles.name, { color: colors.textMuted }]} importantForAccessibility="no">
          {next.name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginBottom: 12,
  },
  card: {
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  nextCard: {},
  label: {
    fontSize: 10,
    color: "#94a3b8",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emoji: {
    fontSize: 32,
  },
  nextEmoji: {
    fontSize: 22,
  },
  name: {
    fontSize: 11,
    marginTop: 2,
  },
});
