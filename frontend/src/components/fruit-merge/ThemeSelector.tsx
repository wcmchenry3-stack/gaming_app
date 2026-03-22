import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { FRUIT_SETS } from "../../theme/fruitSets";
import { useFruitSet } from "../../theme/FruitSetContext";
import { useTheme } from "../../theme/ThemeContext";

export default function ThemeSelector() {
  const { activeFruitSet, setFruitSetById } = useFruitSet();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {Object.values(FRUIT_SETS).map((set) => {
        const active = set.id === activeFruitSet.id;
        return (
          <Pressable
            key={set.id}
            onPress={() => setFruitSetById(set.id)}
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
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
