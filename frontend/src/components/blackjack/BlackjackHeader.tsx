import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

interface BlackjackHeaderProps {
  chips: number;
  onBack: () => void;
}

export default function BlackjackHeader({ chips, onBack }: BlackjackHeaderProps) {
  const { t } = useTranslation("blackjack");
  const { colors, theme, toggle } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.headerBg }]}>
      {/* Back button */}
      <Pressable
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("common:nav.back" as Parameters<typeof t>[0])}
      >
        <Text style={[styles.backText, { color: colors.accent }]}>{"‹"}</Text>
      </Pressable>

      {/* Branding */}
      <View style={styles.brand}>
        <Text style={[styles.brandName, { color: colors.accent, fontFamily: typography.heading }]}>
          {t("header.brandName")}
        </Text>
        <Text
          style={[styles.gameTitle, { color: colors.textMuted, fontFamily: typography.bodyMedium }]}
        >
          {t("game.title")}
        </Text>
      </View>

      {/* Theme toggle */}
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={t("common:theme.switchTo" as Parameters<typeof t>[0], {
          mode:
            theme === "dark"
              ? t("common:theme.light" as Parameters<typeof t>[0])
              : t("common:theme.dark" as Parameters<typeof t>[0]),
        })}
        style={styles.themeToggle}
      >
        <Text style={[styles.themeToggleText, { color: colors.textMuted }]}>
          {theme === "dark" ? "☀︎" : "☾"}
        </Text>
      </Pressable>

      {/* Bankroll */}
      <View style={styles.bankroll}>
        <Text
          style={[styles.bankrollLabel, { color: colors.textMuted, fontFamily: typography.label }]}
        >
          {t("header.bankrollLabel")}
        </Text>
        <Text
          style={[styles.bankrollValue, { color: colors.text, fontFamily: typography.heading }]}
          accessibilityLabel={t("header.bankrollAccessibilityLabel", { chips })}
        >
          {chips.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    fontSize: 28,
    lineHeight: 32,
  },
  brand: {
    alignItems: "center",
    flex: 1,
  },
  brandName: {
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  gameTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  themeToggle: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  themeToggleText: {
    fontSize: 20,
  },
  bankroll: {
    alignItems: "flex-end",
  },
  bankrollLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bankrollValue: {
    fontSize: 18,
    lineHeight: 22,
  },
});
