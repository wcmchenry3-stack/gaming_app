import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

const GLYPHS: Record<string, string> = {
  ones: "1",
  twos: "2",
  threes: "3",
  fours: "4",
  fives: "5",
  sixes: "6",
  three_of_a_kind: "3×",
  four_of_a_kind: "4×",
  full_house: "FH",
  small_straight: "SS",
  large_straight: "LS",
  yacht: "★",
  chance: "?",
};

interface Props {
  category: string;
  tone: "upper" | "lower";
  muted?: boolean;
}

export default function CategoryIcon({ category, tone, muted = false }: Props) {
  const { colors } = useTheme();
  const color = tone === "upper" ? colors.accent : colors.secondary;
  const borderColor = muted ? colors.border : color;
  return (
    <View style={[styles.wrap, { borderColor }]}>
      <Text style={[styles.glyph, { color }]}>{GLYPHS[category] ?? "·"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontSize: 12,
    fontWeight: "700",
  },
});
