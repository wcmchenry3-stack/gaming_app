import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { HomeStackParamList } from "../../App";
import { GameState } from "../game/yacht/types";
import {
  newGame,
  roll as engineRoll,
  score as engineScore,
  possibleScores as enginePossibleScores,
  isInProgress,
  Category,
} from "../game/yacht/engine";
import { saveGame, clearGame } from "../game/yacht/storage";
import * as Sentry from "@sentry/react-native";
import DiceRow from "../components/DiceRow";
import Scorecard from "../components/Scorecard";
import GameOverModal from "../components/yacht/GameOverModal";
import NewGameConfirmModal from "../components/yacht/NewGameConfirmModal";
import { useTheme } from "../theme/ThemeContext";
import { AppHeader, APP_HEADER_HEIGHT } from "../components/shared/AppHeader";

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Game">;
  route: RouteProp<HomeStackParamList, "Game">;
};

export default function GameScreen({ navigation, route }: Props) {
  const { t } = useTranslation(["yacht", "common"]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [gameState, setGameState] = useState<GameState>(route.params.initialState);
  const [possibleScores, setPossibleScores] = useState<Record<string, number>>({});
  const [resetHeld, setResetHeld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [confirmNewGameVisible, setConfirmNewGameVisible] = useState(false);

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

  const handleNewGamePress = useCallback(() => {
    if (isInProgress(gameStateRef.current)) {
      setConfirmNewGameVisible(true);
    } else {
      void startNewGame();
    }
  }, [startNewGame]);

  const handleConfirmNewGame = useCallback(() => {
    setConfirmNewGameVisible(false);
    void startNewGame();
  }, [startNewGame]);

  const roundPill = (
    <View
      style={[styles.roundPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}
    >
      <Text style={[styles.roundPillText, { color: colors.accent }]}>
        {t("round.header", { round: gameState.round })}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: APP_HEADER_HEIGHT + insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      <AppHeader
        title={t("game.title")}
        rightSlot={roundPill}
        onBack={() => navigation.popToTop()}
      />

      {/* New Game */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={handleNewGamePress}
          style={[styles.newGameBtn, { borderColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel={t("newGame.button")}
        >
          <Text style={[styles.newGameText, { color: colors.accent }]}>{t("newGame.button")}</Text>
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

      <GameOverModal
        visible={gameState.game_over}
        totalScore={gameState.total_score}
        upperBonus={gameState.upper_bonus}
        yachtBonusCount={gameState.yacht_bonus_count}
        yachtBonusTotal={gameState.yacht_bonus_total}
        onPlayAgain={startNewGame}
        onDismiss={() => navigation.goBack()}
      />

      <NewGameConfirmModal
        visible={confirmNewGameVisible}
        onConfirm={handleConfirmNewGame}
        onCancel={() => setConfirmNewGameVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roundPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  roundPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  newGameBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
  },
  newGameText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  errorText: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 4,
  },
  scorecardContainer: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: 12,
    marginBottom: 12,
  },
});
