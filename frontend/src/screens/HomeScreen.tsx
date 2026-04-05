import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { newGame as newYachtGame } from "../game/yacht/engine";
import { loadGame as loadYachtGame } from "../game/yacht/storage";
import { useTheme } from "../theme/ThemeContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import OfflineBanner from "../components/OfflineBanner";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

interface GameCard {
  emoji: string;
  title: string;
  description: string;
  action: () => void;
  badge?: string;
}

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation([
    "common",
    "yacht",
    "cascade",
    "blackjack",
    "pachisi",
    "twenty48",
    "errors",
  ]);
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();

  async function startYacht() {
    // Resume an in-progress saved game if one exists, otherwise start fresh.
    const saved = await loadYachtGame();
    const state = saved && !saved.game_over ? saved : newYachtGame();
    navigation.navigate("Game", { initialState: state });
  }

  const games: GameCard[] = [
    {
      emoji: "🎲",
      title: t("yacht:game.title"),
      description: t("yacht:game.description"),
      action: startYacht,
    },
    {
      emoji: "🍉",
      title: t("cascade:game.title"),
      description: t("cascade:game.description"),
      action: () => navigation.navigate("Cascade"),
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
      title: t("pachisi:game.title"),
      description: t("pachisi:game.description"),
      action: () => navigation.navigate("Pachisi"),
    },
    {
      emoji: "🔢",
      title: t("twenty48:game.title"),
      description: t("twenty48:game.description"),
      action: () => navigation.navigate("Twenty48"),
    },
  ];

  const playLabels: Record<string, string> = {
    [t("yacht:game.title")]: t("yacht:game.playLabel"),
    [t("cascade:game.title")]: t("cascade:game.playLabel"),
    [t("blackjack:game.title")]: t("blackjack:game.playLabel"),
    [t("pachisi:game.title")]: t("pachisi:game.playLabel"),
    [t("twenty48:game.title")]: t("twenty48:game.playLabel"),
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.offlineBannerWrap, { top: insets.top }]}>
        <OfflineBanner />
      </View>
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
              accessibilityRole="button"
              accessibilityLabel={playLabels[game.title] ?? game.title}
              accessibilityHint={game.description}
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
              <Text style={[styles.cardArrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>
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
  offlineBannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
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
});
