import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  onHit: () => void;
  onStand: () => void;
  onDoubleDown: () => void;
  onSplit: () => void;
  doubleDownAvailable: boolean;
  splitAvailable: boolean;
  loading: boolean;
}

export default function ActionButtons({
  onHit,
  onStand,
  onDoubleDown,
  onSplit,
  doubleDownAvailable,
  splitAvailable,
  loading,
}: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  const ddLabel = doubleDownAvailable
    ? t("actions.doubleDownLabel")
    : t("actions.doubleDownDisabledLabel");

  const splitLabel = splitAvailable ? t("actions.splitLabel") : t("actions.splitDisabledLabel");

  return (
    <View
      style={[styles.cluster, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
    >
      {/* Hit — primary cyan gradient CTA */}
      <Pressable
        style={[styles.btn, styles.btnHit, { backgroundColor: colors.accent }]}
        onPress={onHit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t("actions.hitLabel")}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        <MaterialIcons name="add" size={28} color={colors.textOnAccent} />
        <Text style={[styles.btnLabel, { color: colors.textOnAccent }]}>{t("actions.hit")}</Text>
      </Pressable>

      {/* Stand — secondary purple outline */}
      <Pressable
        style={[styles.btn, { borderColor: colors.secondary, borderWidth: 2 }]}
        onPress={onStand}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t("actions.standLabel")}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        {/* hand-back-right is the closest MCI equivalent to Material Symbols front_hand */}
        <MaterialCommunityIcons name="hand-back-right" size={28} color={colors.secondary} />
        <Text style={[styles.btnLabel, { color: colors.secondary }]}>{t("actions.stand")}</Text>
      </Pressable>

      {/* Double Down — tertiary outline, disabled when unavailable */}
      <Pressable
        style={[
          styles.btn,
          {
            borderColor: doubleDownAvailable ? colors.border : colors.border,
            borderWidth: 2,
            opacity: doubleDownAvailable ? 1 : 0.4,
          },
        ]}
        onPress={onDoubleDown}
        disabled={!doubleDownAvailable || loading}
        accessibilityRole="button"
        accessibilityLabel={ddLabel}
        accessibilityState={{ disabled: !doubleDownAvailable || loading }}
      >
        {/* numeric-2-circle-outline is the closest MCI equivalent to Material Symbols stat_2 */}
        <MaterialCommunityIcons
          name="numeric-2-circle-outline"
          size={28}
          color={colors.textMuted}
        />
        <Text style={[styles.btnLabel, styles.btnLabelSmall, { color: colors.textMuted }]}>
          {t("actions.doubleDown")}
        </Text>
      </Pressable>

      {/* Split — tertiary outline, disabled when unavailable */}
      <Pressable
        style={[
          styles.btn,
          {
            borderColor: colors.border,
            borderWidth: 2,
            opacity: splitAvailable ? 1 : 0.4,
          },
        ]}
        onPress={onSplit}
        disabled={!splitAvailable || loading}
        accessibilityRole="button"
        accessibilityLabel={splitLabel}
        accessibilityState={{ disabled: !splitAvailable || loading }}
      >
        <MaterialIcons name="call-split" size={28} color={colors.textMuted} />
        <Text style={[styles.btnLabel, { color: colors.textMuted }]}>{t("actions.split")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
  },
  btn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  btnHit: {
    // Shadow for the primary CTA glow effect
    shadowColor: "#8ff5ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  btnLabelSmall: {
    fontSize: 8,
    textAlign: "center",
    lineHeight: 10,
  },
});
