import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { GameState } from "../game/yacht/types";
import {
  newGame,
  roll as engineRoll,
  score as engineScore,
  possibleScores as enginePossibleScores,
  Category,
} from "../game/yacht/engine";
import { saveGame, clearGame } from "../game/yacht/storage";
import * as Sentry from "@sentry/react-native";
import DiceRow from "../components/DiceRow";
import Scorecard from "../components/Scorecard";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Game">;
  route: RouteProp<RootStackParamList, "Game">;
};

export default function GameScreen({ navigation, route }: Props) {
  const { t } = useTranslation(["yacht", "common"]);
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const [gameState, setGameState] = useState<GameState>(route.params.initialState);
  const [possibleScores, setPossibleScores] = useState<Record<string, number>>({});
  const [resetHeld, setResetHeld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState(0);

  // Keep a ref in sync so startNewGame can log the pre-reset state without
  // closing over a stale copy of gameState (useCallback has [] deps).
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Persist state after every change
  useEffect(() => {
    saveGame(gameState);
  }, [gameState]);

  // Recompute possibleScores locally from state
  useEffect(() => {
    setPossibleScores(enginePossibleScores(gameState));
  }, [gameState]);

  function handleRoll(held: boolean[]) {
    setError(null);
    try {
      setGameState((s) => engineRoll(s, held));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleScore(category: string) {
    setError(null);
    try {
      setGameState((s) => engineScore(s, category as Category));
      setResetHeld((r) => !r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const startNewGame = useCallback(async () => {
    const prev = gameStateRef.current;
    Sentry.addBreadcrumb({
      category: "yacht.game",
      message: "startNewGame: resetting",
      data: {
        round: prev.round,
        game_over: prev.game_over,
        upper_subtotal: prev.upper_subtotal,
        total_score: prev.total_score,
      },
      level: "info",
    });
    await clearGame();
    setGameState(newGame());
    setGameKey((k) => k + 1);
    setResetHeld((r) => !r);
    setError(null);
    Sentry.addBreadcrumb({
      category: "yacht.game",
      message: "startNewGame: reset complete",
      level: "info",
    });
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common:nav.backLabel")}
        >
          <Text style={styles.backText}>{t("common:nav.back")}</Text>
        </Pressable>
        <Text style={styles.headerText}>{t("round.header", { round: gameState.round })}</Text>
        <Pressable
          onPress={toggle}
          style={styles.themeToggle}
          accessibilityRole="button"
          accessibilityLabel={t("common:theme.switchTo", {
            mode: theme === "dark" ? t("common:theme.light") : t("common:theme.dark"),
          })}
        >
          <Text style={styles.themeToggleText}>
            {theme === "dark" ? t("common:theme.light") : t("common:theme.dark")}
          </Text>
        </Pressable>
      </View>
      {error && (
        <Text
          style={[styles.errorText, { color: colors.error }]}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      )}

      {/* Dice */}
      <DiceRow
        dice={gameState.dice}
        rollsUsed={gameState.rolls_used}
        gameOver={gameState.game_over}
        onRoll={handleRoll}
        resetHeld={resetHeld}
      />

      {/* Scorecard — key forces full remount on new game, preventing stale
           native-layer rendering in the ScrollView's upper section rows */}
      <View style={styles.scorecardContainer}>
        <Scorecard
          key={gameKey}
          scores={gameState.scores}
          possibleScores={possibleScores}
          rollsUsed={gameState.rolls_used}
          gameOver={gameState.game_over}
          upperSubtotal={gameState.upper_subtotal}
          upperBonus={gameState.upper_bonus}
          yachtBonusCount={gameState.yacht_bonus_count}
          yachtBonusTotal={gameState.yacht_bonus_total}
          totalScore={gameState.total_score}
          onScore={handleScore}
        />
      </View>

      {/* Game Over Modal */}
      <Modal
        visible={gameState.game_over}
        transparent
        animationType="fade"
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]} accessibilityRole="header">
              {t("gameOver.title")}
            </Text>
            <Text style={[styles.modalScore, { color: colors.textMuted }]}>
              {t("gameOver.finalScore")}
            </Text>
            <Text
              style={[styles.modalScoreValue, { color: colors.accent }]}
              accessibilityLabel={t("gameOver.scoreLabel", { score: gameState.total_score })}
            >
              {gameState.total_score}
            </Text>
            {gameState.upper_bonus > 0 && (
              <Text style={[styles.modalBonus, { color: colors.bonus }]}>
                {t("gameOver.upperBonus")}
              </Text>
            )}
            {gameState.yacht_bonus_total > 0 && (
              <Text style={[styles.modalBonus, { color: colors.bonus }]}>
                {t("gameOver.yachtBonus", {
                  count: gameState.yacht_bonus_count,
                  total: gameState.yacht_bonus_total,
                })}
              </Text>
            )}
            <Pressable
              style={[styles.modalButton, { backgroundColor: colors.accent }]}
              onPress={startNewGame}
              accessibilityRole="button"
              accessibilityLabel={t("gameOver.playAgainLabel")}
            >
              <Text style={styles.modalButtonText}>{t("gameOver.playAgain")}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalDismissButton]}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("gameOver.dismissLabel")}
            >
              <Text style={[styles.modalDismissText, { color: colors.textMuted }]}>
                {t("gameOver.dismiss")}
              </Text>
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
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  themeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: "center",
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
    padding: 24,
    alignItems: "center",
    width: "85%",
    maxWidth: 320,
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
  modalDismissButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 8,
  },
  modalDismissText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
