import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  /** Override the default message. Defaults to common:network.offlineBanner. */
  message?: string;
}

export function OfflineBanner({ message }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {message ?? t("network.offlineBanner")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: "100%",
  },
  text: {
    fontSize: 13,
    textAlign: "center",
  },
});
