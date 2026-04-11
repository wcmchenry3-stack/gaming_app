import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

export const APP_HEADER_HEIGHT = 64;

export interface AppHeaderProps {
  title: string;
  rightSlot?: React.ReactNode;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AppHeader({ title, rightSlot }: AppHeaderProps) {
  const { colors, theme } = useTheme();
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();

  const totalHeight = APP_HEADER_HEIGHT + insets.top;
  const bgColor = hexToRgba(colors.background, 0.7);

  return (
    <View
      accessibilityRole="header"
      style={[styles.wrapper, { height: totalHeight }]}
    >
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
        <Text
          style={[styles.wordmark, { color: colors.accent }]}
          numberOfLines={1}
          accessibilityRole="text"
        >
          {t("brand.wordmark")}
        </Text>

        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>

        <View style={styles.rightSlot}>{rightSlot ?? null}</View>
      </View>
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
  wordmark: {
    fontFamily: typography.heading,
    fontSize: 13,
    letterSpacing: -0.3,
    minWidth: 80,
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
});
