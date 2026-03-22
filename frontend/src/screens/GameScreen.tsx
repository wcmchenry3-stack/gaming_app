import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { api, GameState } from "../api/client";
import DiceRow from "../components/DiceRow";
import Scorecard from "../components/Scorecard";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Game">;
  route: RouteProp<RootStackParamList, "Game">;
};

export default function GameScreen({ navigation, route }: Props) {
  const { colors, theme, toggle } = useTheme();
  const [gameState, setGameState] = useState<GameState>(route.params.initialState);
  const [possibleScores, setPossibleScores] = useState<Record<string, number>>({});
  const [resetHeld, setResetHeld] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPossibleScores = useCallback(async (rolls_used: number) => {
    if (rolls_used === 0) { setPossibleScores({}); return; }
    try {
      const res = await api.possibleScores();
      setPossibleScores(res.possible_scores);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchPossibleScores(gameState.rolls_used);
  }, [gameState.rolls_used, gameState.round]);

  async function handleRoll(held: boolean[]) {
    setError(null);
    try {
      setGameState(await api.roll(held));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function handleScore(category: string) {
    setError(null);
    try {
      setGameState(await api.score(category));
      setResetHeld((r) => !r);
      setPossibleScores({});
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={styles.headerText}>Round {gameState.round} / 13</Text>
        <Pressable onPress={toggle} style={styles.themeToggle}>
          <Text style={styles.themeToggleText}>
            {theme === "dark" ? "Light" : "Dark"}
          </Text>
        </Pressable>
      </View>
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}

      {/* Dice */}
      <DiceRow
        dice={gameState.dice}
        rollsUsed={gameState.rolls_used}
        gameOver={gameState.game_over}
        onRoll={handleRoll}
        resetHeld={resetHeld}
      />

      {/* Scorecard */}
      <View style={styles.scorecardContainer}>
        <Scorecard
          scores={gameState.scores}
          possibleScores={possibleScores}
          rollsUsed={gameState.rolls_used}
          gameOver={gameState.game_over}
          upperSubtotal={gameState.upper_subtotal}
          upperBonus={gameState.upper_bonus}
          totalScore={gameState.total_score}
          onScore={handleScore}
        />
      </View>

      {/* Game Over Modal */}
      <Modal visible={gameState.game_over} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Game Over!</Text>
            <Text style={[styles.modalScore, { color: colors.textMuted }]}>Final Score</Text>
            <Text style={[styles.modalScoreValue, { color: colors.accent }]}>
              {gameState.total_score}
            </Text>
            {gameState.upper_bonus > 0 && (
              <Text style={[styles.modalBonus, { color: colors.bonus }]}>
                +35 Upper Bonus included!
              </Text>
            )}
            <Pressable
              style={[styles.modalButton, { backgroundColor: colors.accent }]}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.modalButtonText}>Play Again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerText: {
    color: "#facc15",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  themeToggle: {
    position: "absolute",
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  themeToggleText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  errorText: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 4,
  },
  scorecardContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    width: 280,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalScore: {
    fontSize: 16,
    marginBottom: 4,
  },
  modalScoreValue: {
    fontSize: 52,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalBonus: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
