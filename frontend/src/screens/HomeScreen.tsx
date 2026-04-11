import React from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { newGame as newYachtGame } from "../game/yacht/engine";
import { loadGame as loadYachtGame } from "../game/yacht/storage";
import { useTheme } from "../theme/ThemeContext";
import OfflineBanner from "../components/OfflineBanner";

interface GameCard {
  key: string;
  emoji: string;
  title: string;
  description: string;
  action: () => void;
}

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, "Home">>();
  const { t } = useTranslation([
    "common",
    "yacht",
    "cascade",
    "blackjack",
    "pachisi",
    "twenty48",
    "errors",
  ]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  async function startYacht() {
    const saved = await loadYachtGame();
    const state = saved && !saved.game_over ? saved : newYachtGame();
    navigation.navigate("Game", { initialState: state });
  }

  const games: GameCard[] = [
    {
      key: "yacht",
      emoji: "🎲",
      title: t("yacht:game.title"),
      description: t("yacht:game.description"),
      action: startYacht,
    },
    {
      key: "cascade",
      emoji: "🍉",
      title: t("cascade:game.title"),
      description: t("cascade:game.description"),
      action: () => navigation.navigate("Cascade"),
    },
    {
      key: "blackjack",
      emoji: "🃏",
      title: t("blackjack:game.title"),
      description: t("blackjack:game.description"),
      action: () => navigation.navigate("BlackjackBetting"),
    },
    {
      key: "twenty48",
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
    [t("twenty48:game.title")]: t("twenty48:game.playLabel"),
  };

  function renderCard({ item }: { item: GameCard }) {
    return (
      <View style={styles.cardWrapper}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceHigh,
              borderTopColor: colors.accent,
            },
          ]}
          onPress={item.action}
          accessibilityRole="button"
          accessibilityLabel={playLabels[item.title] ?? item.title}
          accessibilityHint={item.description}
        >
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={[styles.playBtn, { backgroundColor: colors.accent }]}>
            <Text style={[styles.playBtnText, { color: colors.textOnAccent }]}>
              {t("common:play", "Play")}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.offlineBannerWrap}>
        <OfflineBanner />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t("common:app.title")}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("common:app.subtitle")}</Text>

      <FlatList
        data={games}
        renderItem={renderCard}
        keyExtractor={(item) => item.key}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 16,
  },
  offlineBannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },
  grid: {
    width: "100%",
    maxWidth: 480,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: 24,
    borderTopWidth: 3,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  cardEmoji: {
    fontSize: 40,
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardDesc: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  playBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
