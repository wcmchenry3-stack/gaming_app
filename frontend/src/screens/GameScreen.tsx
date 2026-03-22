import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { api, GameState } from "../api/client";
import DiceRow from "../components/DiceRow";
import Scorecard from "../components/Scorecard";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Game">;
  route: RouteProp<RootStackParamList, "Game">;
};

export default function GameScreen({ navigation, route }: Props) {
  const [gameState, setGameState] = useState<GameState>(route.params.initialState);
  const [possibleScores, setPossibleScores] = useState<Record<string, number>>({});
  const [resetHeld, setResetHeld] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPossibleScores = useCallback(async (rolls_used: number) => {
    if (rolls_used === 0) {
      setPossibleScores({});
      return;
    }
    try {
      const res = await api.possibleScores();
      setPossibleScores(res.possible_scores);
    } catch {
      // non-critical, ignore
    }
  }, []);

  useEffect(() => {
    fetchPossibleScores(gameState.rolls_used);
  }, [gameState.rolls_used, gameState.round]);

  async function handleRoll(held: boolean[]) {
    setError(null);
    try {
      const state = await api.roll(held);
      setGameState(state);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleScore(category: string) {
    setError(null);
    try {
      const state = await api.score(category);
      setGameState(state);
      setResetHeld((r) => !r); // signal DiceRow to clear held
      setPossibleScores({});
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleNewGame() {
    navigation.navigate("Home");
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Round {gameState.round} / 13</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

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
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Game Over!</Text>
            <Text style={styles.modalScore}>Final Score</Text>
            <Text style={styles.modalScoreValue}>{gameState.total_score}</Text>
            {gameState.upper_bonus > 0 && (
              <Text style={styles.modalBonus}>+35 Upper Bonus included!</Text>
            )}
            <Pressable style={styles.modalButton} onPress={handleNewGame}>
              <Text style={styles.modalButtonText}>Play Again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  headerText: {
    color: "#facc15",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#f87171",
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
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    width: 280,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  modalScore: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 4,
  },
  modalScoreValue: {
    fontSize: 52,
    fontWeight: "800",
    color: "#2563eb",
    marginBottom: 4,
  },
  modalBonus: {
    fontSize: 13,
    color: "#16a34a",
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: "#2563eb",
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
