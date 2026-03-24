import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { FRUIT_SETS } from "../../theme/fruitSets";
import { useFruitSet } from "../../theme/FruitSetContext";
import { useTheme } from "../../theme/ThemeContext";

export default function ThemeSelector() {
  const { t } = useTranslation("fruit-merge");
  const { activeFruitSet, setFruitSetById } = useFruitSet();
  const { colors } = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t("theme.groupLabel")}
    >
      {Object.values(FRUIT_SETS).map((set) => {
        const active = set.id === activeFruitSet.id;
        return (
          <Pressable
            key={set.id}
            onPress={() => setFruitSetById(set.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t("theme.optionLabel", { label: set.label })}
            style={[
              styles.pill,
              {
                backgroundColor: active ? colors.accent : colors.surface,
                borderColor: active ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: active ? "#fff" : colors.textMuted }]}>
              {set.fruits[10].emoji} {set.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
