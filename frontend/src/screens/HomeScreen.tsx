import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { api } from "../api/client";
import { useTheme } from "../theme/ThemeContext";

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
}

export default function HomeScreen({ navigation }: Props) {
  const { colors, theme, toggle } = useTheme();
  const [yahtzeeLoading, setYahtzeeLoading] = useState(false);
  const [yahtzeeError, setYahtzeeError] = useState<string | null>(null);

  async function startYahtzee() {
    setYahtzeeLoading(true);
    setYahtzeeError(null);
    try {
      const state = await api.newGame();
      navigation.navigate("Game", { initialState: state });
    } catch {
      setYahtzeeError("Could not connect to backend. Is the server running?");
    } finally {
      setYahtzeeLoading(false);
    }
  }

  const games: GameCard[] = [
    {
      emoji: "🎲",
      title: "Yahtzee",
      description: "Roll dice, score categories, beat your high score.",
      action: startYahtzee,
      loading: yahtzeeLoading,
      error: yahtzeeError,
    },
    {
      emoji: "🍉",
      title: "Fruit Merge",
      description: "Drop fruit, merge matches, don't let them overflow.",
      action: () => navigation.navigate("FruitMerge"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable style={styles.themeToggle} onPress={toggle}>
        <Text style={[styles.themeToggleText, { color: colors.textMuted }]}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.text }]}>Gaming App</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Choose a game</Text>

      <View style={styles.cards}>
        {games.map((game) => (
          <View key={game.title}>
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={game.action}
              disabled={game.loading}
            >
              <Text style={styles.cardEmoji}>{game.emoji}</Text>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{game.title}</Text>
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{game.description}</Text>
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
  themeToggle: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
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
