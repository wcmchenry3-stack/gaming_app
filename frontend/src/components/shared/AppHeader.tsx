import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, Platform, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import FeedbackWidget from "../FeedbackWidget/FeedbackWidget";
import logoSource from "../../../assets/logo.png";

export const APP_HEADER_HEIGHT = 64;

export interface AppHeaderProps {
  title: string;
  rightSlot?: React.ReactNode;
  onBack?: () => void;
  /**
   * Screens that must always show a back button set this to true. If onBack
   * is missing at mount, AppHeader reports a Sentry warning so a regression
   * (e.g. accidental refactor that drops the handler) surfaces in telemetry
   * instead of stranding users on the screen. See GH #498.
   */
  requireBack?: boolean;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alphaHex}`;
}

export function AppHeader({ title, rightSlot, onBack, requireBack = false }: AppHeaderProps) {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("feedback");
  const [helpOpen, setHelpOpen] = useState(false);

  const totalHeight = APP_HEADER_HEIGHT + insets.top;
  const bgColor = hexWithAlpha(colors.background, 0.7);

  // #498 — mount-time telemetry: record whether the back affordance is wired
  // up so we can detect regressions where a screen silently drops onBack.
  useEffect(() => {
    Sentry.addBreadcrumb({
      category: "ui.header",
      level: "info",
      message: "AppHeader mount",
      data: { title, hasBack: !!onBack, requireBack },
    });
    if (requireBack && !onBack) {
      Sentry.captureMessage(
        `AppHeader[${title}] rendered without onBack despite requireBack`,
        "warning"
      );
    }
    // Intentionally run once per mount — we care about the initial render of
    // each screen, not every prop toggle. Screens remount on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #498 — tap-time telemetry: wrap onBack so a breadcrumb lands in Sentry
  // the instant the press registers. If users report "back does nothing" we
  // can distinguish "tap never fired" from "handler fired but navigation
  // silently failed" by whether this breadcrumb is present.
  const handleBackPress = onBack
    ? () => {
        Sentry.addBreadcrumb({
          category: "ui.header",
          level: "info",
          message: "AppHeader back press",
          data: { title },
        });
        onBack();
      }
    : undefined;

  return (
    <View accessibilityRole="header" style={[styles.wrapper, { height: totalHeight }]}>
      {Platform.OS === "web" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: bgColor,
              // React Native Web passes unknown style props through to CSS
              ...Platform.select({
                web: {
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                } as object,
              }),
            },
          ]}
        />
      ) : (
        <BlurView
          intensity={80}
          tint={theme === "dark" ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.content, { paddingTop: insets.top }]}>
        {handleBackPress ? (
          <Pressable
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel={t("common:nav.backLabel")}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            hitSlop={12}
          >
            <Text style={[styles.backText, { color: colors.text }]}>{t("common:nav.back")}</Text>
          </Pressable>
        ) : (
          <Image
            source={logoSource}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="BC Arcade"
            accessibilityRole="image"
          />
        )}

        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>

        <View style={styles.rightSlot}>{rightSlot ?? null}</View>

        <Pressable
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("fab_label")}
          style={({ pressed }) => [
            styles.helpButton,
            { backgroundColor: colors.accent },
            pressed && styles.helpButtonPressed,
          ]}
          hitSlop={8}
        >
          <Text style={[styles.helpButtonText, { color: colors.textOnAccent }]}>?</Text>
        </Pressable>
      </View>

      <FeedbackWidget visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    shadowColor: "#8ff5ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  logo: {
    width: 80,
    height: 32,
  },
  backButton: {
    width: 80,
    height: 32,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backText: {
    fontFamily: typography.heading,
    fontSize: 15,
  },
  title: {
    fontFamily: typography.heading,
    fontSize: 16,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  rightSlot: {
    minWidth: 80,
    alignItems: "flex-end",
  },
  helpButton: {
    marginLeft: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  helpButtonPressed: {
    opacity: 0.7,
  },
  helpButtonText: {
    fontFamily: typography.heading,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
});
