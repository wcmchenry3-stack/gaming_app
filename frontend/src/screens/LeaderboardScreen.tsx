import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";
import { AppHeader, APP_HEADER_HEIGHT } from "../components/shared/AppHeader";

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: APP_HEADER_HEIGHT + insets.top },
      ]}
    >
      <AppHeader title={t("nav.ranks")} />
      <Text style={[styles.icon]}>🏆</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  icon: { fontSize: 48, marginBottom: 16 },
  subtitle: { fontSize: 16 },
});
