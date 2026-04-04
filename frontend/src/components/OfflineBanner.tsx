/**
 * Subtle banner shown when the device is offline.
 *
 * Reads status from NetworkContext. Renders nothing while network state
 * is still initializing, so users don't see a flash of "offline" on boot.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNetwork } from "../game/_shared/NetworkContext";
import { useTheme } from "../theme/ThemeContext";

export default function OfflineBanner() {
  const { isOnline, isInitialized } = useNetwork();
  const { t } = useTranslation("common");
  const { colors } = useTheme();

  if (!isInitialized || isOnline) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.textMuted }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{t("network.offlineBanner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
