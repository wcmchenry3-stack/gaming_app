import React from "react";
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";

interface DieProps {
  value: number;
  held: boolean;
  onPress: () => void;
  disabled: boolean;
  index: number;
}

// Pip positions in a 3x3 grid, indexed 0..8 (row-major)
// 0 1 2
// 3 4 5
// 6 7 8
const PIP_PATTERNS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function Die({ value, held, onPress, disabled, index }: DieProps) {
  const { t } = useTranslation("yacht");
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const dieSize = Math.min(60, (width - 80) / 5);
  const pipSize = Math.max(6, Math.round(dieSize * 0.14));

  const displayValue = value > 0 ? value : t("dice.labelBlank");
  const heldSuffix = held ? t("dice.heldSuffix") : "";
  const label = t("dice.label", { index: index + 1, value: displayValue, heldSuffix });

  const pips = PIP_PATTERNS[value] ?? [];
  const pipColor = held ? colors.accent : colors.text;

  // Web-only neon glow when held
  const glowStyle: ViewStyle | null =
    held && Platform.OS === "web"
      ? ({
          boxShadow: `0 0 14px ${colors.accent}66, 0 0 4px ${colors.accent}`,
        } as ViewStyle)
      : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ checked: held, disabled }}
      accessibilityLabel={label}
      accessibilityHint={disabled ? undefined : held ? t("dice.unholdHint") : t("dice.holdHint")}
      style={({ pressed }) => [
        styles.die,
        {
          width: dieSize,
          height: dieSize,
          backgroundColor: held ? colors.heldBg : colors.dieBg,
          borderColor: held ? colors.heldBorder : colors.dieBorder,
          borderWidth: held ? 2 : 1,
          transform: [{ scale: pressed && !disabled ? 0.95 : 1 }],
        },
        glowStyle,
        disabled && styles.disabled,
      ]}
    >
      {value > 0 ? (
        <View style={styles.grid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={styles.cell}>
              {pips.includes(i) && (
                <View
                  style={{
                    width: pipSize,
                    height: pipSize,
                    borderRadius: pipSize / 2,
                    backgroundColor: pipColor,
                  }}
                />
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.blank, { color: colors.textMuted }]}>—</Text>
      )}
      {held && (
        <View
          style={[styles.heldBadge, { backgroundColor: colors.accent }]}
          importantForAccessibility="no"
        >
          <Text style={[styles.heldBadgeText, { color: colors.textOnAccent }]}>HELD</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  die: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
    padding: 6,
  },
  disabled: {
    opacity: 0.4,
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    height: "100%",
  },
  cell: {
    width: "33.333%",
    height: "33.333%",
    alignItems: "center",
    justifyContent: "center",
  },
  blank: {
    fontSize: 22,
    fontWeight: "700",
  },
  heldBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  heldBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
