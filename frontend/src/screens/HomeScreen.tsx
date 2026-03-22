import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { api } from "../api/client";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

export default function HomeScreen({ navigation }: Props) {
  const { colors, theme, toggle } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startGame() {
    setLoading(true);
    setError(null);
    try {
      const state = await api.newGame();
      navigation.navigate("Game", { initialState: state });
    } catch {
      setError("Could not connect to backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable style={styles.themeToggle} onPress={toggle}>
        <Text style={[styles.themeToggleText, { color: colors.textMuted }]}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Text>
      </Pressable>

      <Text style={[styles.title, { color: "#facc15" }]}>Yahtzee</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Single Player</Text>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={startGame} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>New Game</Text>
        )}
      </Pressable>
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
    fontSize: 56,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 48,
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 180,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  error: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
});
