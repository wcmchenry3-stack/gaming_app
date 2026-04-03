import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Sentry from "@sentry/react-native";
import { RootStackParamList } from "../../App";
import { api } from "../api/client";
import { useTheme } from "../theme/ThemeContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

interface GameCard {
  emoji: string;
  title: string;
  description: string;
  action: () => void;
  loading?: boolean;
  error?: string | null;
  badge?: string;
}

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation(["common", "yacht", "fruit-merge", "blackjack", "ludo", "errors"]);
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const [yachtLoading, setYachtLoading] = useState(false);
  const [yachtError, setYachtError] = useState<string | null>(null);

  async function startYacht() {
    setYachtLoading(true);
    setYachtError(null);
    try {
      const state = await api.newGame();
      navigation.navigate("Game", { initialState: state });
    } catch (e) {
      Sentry.captureException(e, {
        tags: { screen: "HomeScreen", game: "yacht" },
        extra: { action: "startYacht" },
      });
      setYachtError(t("errors:backend.connection"));
    } finally {
      setYachtLoading(false);
    }
  }

  const games: GameCard[] = [
    {
      emoji: "🎲",
      title: t("yacht:game.title"),
      description: t("yacht:game.description"),
      action: startYacht,
      loading: yachtLoading,
      error: yachtError,
    },
    {
      emoji: "🍉",
      title: t("fruit-merge:game.title"),
      description: t("fruit-merge:game.description"),
      action: () => navigation.navigate("FruitMerge"),
      badge: undefined,
    },
    {
      emoji: "🃏",
      title: t("blackjack:game.title"),
      description: t("blackjack:game.description"),
      action: () => navigation.navigate("Blackjack"),
    },
    {
      emoji: "🎯",
      title: t("ludo:game.title"),
      description: t("ludo:game.description"),
      action: () => navigation.navigate("Ludo"),
    },
  ];

  const playLabels: Record<string, string> = {
    [t("yacht:game.title")]: t("yacht:game.playLabel"),
    [t("fruit-merge:game.title")]: t("fruit-merge:game.playLabel"),
    [t("blackjack:game.title")]: t("blackjack:game.playLabel"),
    [t("ludo:game.title")]: t("ludo:game.playLabel"),
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { top: insets.top + 8 }]}>
        <Pressable
          style={styles.themeToggle}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={t("common:theme.switchTo", {
            mode: theme === "dark" ? t("common:theme.light") : t("common:theme.dark"),
          })}
        >
          <Text style={[styles.themeToggleText, { color: colors.textMuted }]}>
            {theme === "dark" ? t("common:theme.light") : t("common:theme.dark")}
          </Text>
        </Pressable>
        <LanguageSwitcher />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{t("common:app.title")}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("common:app.subtitle")}</Text>

      <View style={styles.cards}>
        {games.map((game) => (
          <View key={game.title}>
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={game.action}
              disabled={game.loading}
              accessibilityRole="button"
              accessibilityLabel={playLabels[game.title] ?? game.title}
              accessibilityHint={game.description}
              accessibilityState={{ disabled: game.loading, busy: game.loading }}
            >
              <Text style={styles.cardEmoji}>{game.emoji}</Text>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{game.title}</Text>
                  {game.badge && (
                    <View style={[styles.badge, { backgroundColor: colors.textMuted }]}>
                      <Text style={styles.badgeText}>{game.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                  {game.description}
                </Text>
              </View>
              {game.loading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.cardArrow, { color: colors.textMuted }]}>›</Text>
              )}
            </Pressable>
            {game.error && (
              <Text style={[styles.error, { color: colors.error }]}>{game.error}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  headerRow: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themeToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  themeToggleText: {
    fontSize: 13,
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: 40,
  },
  cards: {
    width: "100%",
    maxWidth: 480,
    gap: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  cardEmoji: {
    fontSize: 36,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
  },
  cardDesc: {
    fontSize: 13,
  },
  cardArrow: {
    fontSize: 28,
    lineHeight: 32,
  },
  error: {
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
});
