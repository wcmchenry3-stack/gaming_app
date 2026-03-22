import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";

interface DieProps {
  value: number;
  held: boolean;
  onPress: () => void;
  disabled: boolean;
}

export default function Die({ value, held, onPress, disabled }: DieProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.die,
        {
          backgroundColor: held ? colors.heldBg : colors.dieBg,
          borderColor: held ? colors.heldBorder : colors.dieBorder,
        },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.value, { color: colors.text }]}>
        {value > 0 ? value : "—"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  die: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
  },
  disabled: {
    opacity: 0.4,
  },
  value: {
    fontSize: 26,
    fontWeight: "700",
  },
});
