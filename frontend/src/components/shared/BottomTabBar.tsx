import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../../theme/ThemeContext";

const TAB_ITEMS: Record<string, { emoji: string; label: string }> = {
  Lobby: { emoji: "🏠", label: "Lobby" },
  Ranks: { emoji: "🏆", label: "Ranks" },
  Profile: { emoji: "👤", label: "Profile" },
  Settings: { emoji: "⚙️", label: "Settings" },
};

export default function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom || 8,
          backgroundColor: "rgba(14, 14, 19, 0.85)",
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TAB_ITEMS[route.name] ?? { emoji: "?", label: route.name };

        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={[styles.tab, focused && { backgroundColor: colors.accent }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
          >
            <Text style={styles.emoji}>{tab.emoji}</Text>
            <Text style={[styles.label, { color: focused ? "#0e0e13" : "#6e6e7a" }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: 72,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 2,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: "600" },
});
