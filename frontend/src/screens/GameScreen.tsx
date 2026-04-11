import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
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

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Game">;
  route: RouteProp<HomeStackParamList, "Game">;
};

export default function GameScreen({ navigation, route }: Props) {
  const { t } = useTranslation(["yacht", "common"]);
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const showHeaderTotal = viewportWidth >= 480;
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
      <View
        style={[
          styles.header,
          { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerSide}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common:nav.backLabel")}
          >
            <Text style={[styles.navText, { color: colors.textMuted }]}>
              {t("common:nav.back")}
            </Text>
          </Pressable>
        </View>
        <View
          style={[
            styles.roundPill,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.roundPillText, { color: colors.accent }]}>
            {t("round.header", { round: gameState.round })}
          </Text>
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {showHeaderTotal && (
            <View
              style={styles.totalBox}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
                {t("section.total")}
              </Text>
              <Text style={[styles.totalValue, { color: colors.accent }]}>
                {gameState.total_score}
              </Text>
            </View>
          )}
          <Pressable
            onPress={handleNewGamePress}
            style={[styles.newGameBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t("newGame.button")}
          >
            <Text style={[styles.newGameText, { color: colors.accent }]}>
              {t("newGame.button")}
            </Text>
          </Pressable>
          <Pressable
            onPress={toggle}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common:theme.switchTo", {
              mode: theme === "dark" ? t("common:theme.light") : t("common:theme.dark"),
            })}
          >
            <Text style={[styles.navText, { color: colors.textMuted }]}>
              {theme === "dark" ? t("common:theme.light") : t("common:theme.dark")}
            </Text>
          </Pressable>
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headerSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerSideRight: {
    justifyContent: "flex-end",
  },
  roundPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  roundPillText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: "center",
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
  navText: {
    fontSize: 13,
    fontWeight: "600",
  },
  totalBox: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 18,
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
});
