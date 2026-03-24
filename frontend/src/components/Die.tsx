import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";

interface DieProps {
  value: number;
  held: boolean;
  onPress: () => void;
  disabled: boolean;
  index: number;
}

export default function Die({ value, held, onPress, disabled, index }: DieProps) {
  const { colors } = useTheme();
  const displayValue = value > 0 ? value : "blank";
  const label = `Die ${index + 1}: showing ${displayValue}${held ? ", held" : ""}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: held, disabled }}
      accessibilityLabel={label}
      accessibilityHint={
        disabled ? undefined : held ? "Double-tap to unhold" : "Double-tap to hold"
      }
      style={[
        styles.die,
        {
          backgroundColor: held ? colors.heldBg : colors.dieBg,
          borderColor: held ? colors.heldBorder : colors.dieBorder,
        },
        disabled && styles.disabled,
      ]}
    >
      {held && (
        <Text style={styles.heldBadge} importantForAccessibility="no">
          ✓
        </Text>
      )}
      <Text style={[styles.value, { color: colors.text }]}>{value > 0 ? value : "—"}</Text>
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
  heldBadge: {
    position: "absolute",
    top: 2,
    right: 4,
    fontSize: 10,
    color: "#2563eb",
    fontWeight: "700",
  },
});
