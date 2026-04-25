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
import { useYachtScorecard } from "../game/yacht/ScorecardContext";
import { useGameSync } from "../game/_shared/useGameSync";
import * as Sentry from "@sentry/react-native";
import DiceRow from "../components/DiceRow";
import Scorecard from "../components/Scorecard";
import GameOverModal from "../components/yacht/GameOverModal";
import NewGameConfirmModal from "../components/shared/NewGameConfirmModal";
import { useTheme } from "../theme/ThemeContext";
import { GameShell } from "../components/shared/GameShell";

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

  // Game event instrumentation (#368 / #549).
  const {
    start: syncStart,
    markStarted: syncMarkStarted,
    enqueue: syncEnqueue,
    complete: syncComplete,
  } = useGameSync("yacht");

  function endedPayload(s: GameState, outcome: "completed" | "abandoned") {
    return {
      final_score: s.total_score,
      upper_bonus: s.upper_bonus,
      yacht_bonus_total: s.yacht_bonus_total,
      outcome,
    };
  }

  useEffect(() => {
    if (gameStateRef.current.game_over) return;
    syncStart();
    // Unmount abandon is handled by useGameSync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state after every change
  useEffect(() => {
    saveGame(gameState);
  }, [gameState]);

  // Sync snapshot to shared scorecard context (read by ScoreboardScreen).
  const { setSnapshot: setScorecardSnapshot } = useYachtScorecard();
  useEffect(() => {
    setScorecardSnapshot({
      scores: gameState.scores,
      upperSubtotal: gameState.upper_subtotal,
      upperBonus: gameState.upper_bonus,
      yachtBonusCount: gameState.yacht_bonus_count,
      totalScore: gameState.total_score,
    });
  }, [gameState, setScorecardSnapshot]);

  // Recompute possibleScores locally from state
  useEffect(() => {
    setPossibleScores(enginePossibleScores(gameState));
  }, [gameState]);

  function handleRoll(held: boolean[]) {
    setError(null);
    syncMarkStarted();
    try {
      const next = engineRoll(gameState, held);
      setGameState(next);
      syncEnqueue({
        type: "roll",
        data: {
          held: [...next.held],
          dice: [...next.dice],
          rolls_used_after: next.rolls_used,
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleScore(category: string) {
    setError(null);
    try {
      const prev = gameState;
      const alternatives = possibleScores;
      const next = engineScore(prev, category as Category);
      setGameState(next);
      setResetHeld((r) => !r);
      const value = next.scores[category as Category] ?? 0;
      const isJoker = next.yacht_bonus_count > prev.yacht_bonus_count;
      syncEnqueue({
        type: "score",
        data: {
          category,
          value,
          is_joker: isJoker,
          available_alternatives: alternatives,
        },
      });
      if (next.game_over) {
        syncComplete(
          { finalScore: next.total_score, outcome: "completed" },
          endedPayload(next, "completed")
        );
      }
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
    // If the game is mid-play, close the session as abandoned with the full
    // payload. If game_over is true, syncComplete was already called in
    // handleScore — this is a no-op due to the completedRef guard.
    const outcome = prev.game_over ? "completed" : "abandoned";
    syncComplete({ finalScore: prev.total_score, outcome }, endedPayload(prev, outcome));
    await clearGame();
    setGameState(newGame());
    setGameKey((k) => k + 1);
    setResetHeld((r) => !r);
    setError(null);
    // Start a new instrumentation session for the fresh game.
    syncStart();
    Sentry.addBreadcrumb({
      category: "yacht.game",
      message: "startNewGame: reset complete",
      level: "info",
    });
  }, [syncComplete, syncStart]);

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
    <GameShell
      title={t("game.title")}
      rightSlot={roundPill}
      requireBack
      onBack={() => navigation.popToTop()}
      onNewGame={startNewGame}
      onOpenScoreboard={() => navigation.navigate("Scoreboard", { gameKey: "yacht" })}
      error={error}
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 16),
        paddingRight: Math.max(insets.right, 16),
      }}
    >
      {/* New Game */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={handleNewGamePress}
          style={[styles.newGameBtn, { borderColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel={t("common:newGame.button")}
        >
          <Text style={[styles.newGameText, { color: colors.accent }]}>
            {t("common:newGame.button")}
          </Text>
        </Pressable>
      </View>

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
    </GameShell>
  );
}

const styles = StyleSheet.create({
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
