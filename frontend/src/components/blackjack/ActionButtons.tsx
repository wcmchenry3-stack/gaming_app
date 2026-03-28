import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  onHit: () => void;
  onStand: () => void;
  onDoubleDown: () => void;
  doubleDownAvailable: boolean;
  loading: boolean;
}

export default function ActionButtons({
  onHit,
  onStand,
  onDoubleDown,
  doubleDownAvailable,
  loading,
}: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  const ddLabel = doubleDownAvailable
    ? t("actions.doubleDownLabel")
    : t("actions.doubleDownDisabledLabel");

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.btn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
        onPress={onHit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t("actions.hitLabel")}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        <Text style={[styles.btnText, { color: colors.surface }]}>{t("actions.hit")}</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onStand}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t("actions.standLabel")}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        <Text style={[styles.btnText, { color: colors.text }]}>{t("actions.stand")}</Text>
      </Pressable>

      <Pressable
        style={[
          styles.btn,
          {
            backgroundColor: doubleDownAvailable ? colors.surface : colors.border,
            borderColor: doubleDownAvailable ? colors.border : "transparent",
            opacity: doubleDownAvailable ? 1 : 0.5,
          },
        ]}
        onPress={onDoubleDown}
        disabled={!doubleDownAvailable || loading}
        accessibilityRole="button"
        accessibilityLabel={ddLabel}
        accessibilityState={{ disabled: !doubleDownAvailable || loading }}
      >
        <Text style={[styles.btnText, { color: colors.text }]}>{t("actions.doubleDown")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
