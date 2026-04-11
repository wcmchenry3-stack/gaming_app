import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function SettingsScreen() {
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t("screens.settings", "Settings")}
      </Text>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>{t("theme.label", "Theme")}</Text>
        <Pressable
          onPress={toggle}
          style={[styles.toggle, { backgroundColor: colors.surfaceAlt }]}
          testID="theme-toggle-button"
          accessibilityRole="button"
          accessibilityLabel={t("theme.switchTo", {
            mode: theme === "dark" ? t("theme.light") : t("theme.dark"),
          })}
        >
          <Text style={{ color: colors.text }}>
            {theme === "dark" ? t("theme.light", "Light") : t("theme.dark", "Dark")}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("settings.language", "Language")}
        </Text>
        <LanguageSwitcher />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24, marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  label: { fontSize: 16 },
  toggle: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
});
