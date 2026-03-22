import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { api } from "../api/client";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startGame() {
    setLoading(true);
    setError(null);
    try {
      const state = await api.newGame();
      navigation.navigate("Game", { initialState: state });
    } catch (e: any) {
      setError("Could not connect to backend. Is the Python server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎲 Yahtzee</Text>
      <Text style={styles.subtitle}>Single Player</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={startGame} disabled={loading}>
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
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 56,
    fontWeight: "800",
    color: "#facc15",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#94a3b8",
    marginBottom: 48,
  },
  button: {
    backgroundColor: "#2563eb",
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
    color: "#f87171",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
});
