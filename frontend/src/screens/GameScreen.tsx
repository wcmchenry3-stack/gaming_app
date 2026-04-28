import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal, ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
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
  toggleHold as engineToggleHold,
  possibleScores as enginePossibleScores,
  isInProgress,
  setDiceOverride,
  Category,
} from "../game/yacht/engine";
import { saveGame, clearGame } from "../game/yacht/storage";
import { useYachtScorecard } from "../game/yacht/ScorecardContext";
import { useGameSync } from "../game/_shared/useGameSync";
import { useGameEvents } from "../game/_shared/useGameEvents";
import { useSound } from "../game/_shared/useSound";
import * as Sentry from "@sentry/react-native";
import DiceRow from "../components/DiceRow";
import Scorecard from "../components/Scorecard";
import GameOverModal from "../components/yacht/GameOverModal";
import { YachtCelebrationAnimation } from "../components/yacht/YachtCelebrationAnimation";
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
  const [gameKey, setGameKey] = useState(0);
  const [confirmNewGameVisible, setConfirmNewGameVisible] = useState(false);
  const [showYachtCelebration, setShowYachtCelebration] = useState(false);
  const [showJokerCelebration, setShowJokerCelebration] = useState(false);
  const [rollingIndices, setRollingIndices] = useState<readonly number[]>([]);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devDice, setDevDice] = useState<[number, number, number, number, number]>([3, 3, 3, 3, 3]);

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

  // Sound hooks
  const { play: playDiceRoll } = useSound("yacht.diceRoll");
  const { play: playDieHold } = useSound("yacht.dieHold");
  const { play: playYacht } = useSound("yacht.yacht");
  const { play: playJoker } = useSound("yacht.joker");
  const { play: playStraight } = useSound("yacht.straight");
  const { play: playUpperBonus } = useSound("yacht.upperBonus");

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

  // Process game events — play sounds, trigger animations, then clear
  useGameEvents(
    gameState.events,
    {
      diceRoll: (e) => {
        playDiceRoll();
        setRollingIndices(e.rolledIndices);
        // Clear the rolling animation flag after the die spin duration
        setTimeout(() => setRollingIndices([]), 400);
      },
      dieHold: () => playDieHold(),
      dieRelease: () => playDieHold(),
      yacht: () => {
        playYacht();
        setShowYachtCelebration(true);
      },
      joker: () => {
        playJoker();
        setShowJokerCelebration(true);
      },
      largeStraight: () => playStraight(),
      smallStraight: () => playStraight(),
      upperBonus: () => playUpperBonus(),
    },
    () => setGameState((prev) => (prev === null ? prev : { ...prev, events: undefined }))
  );

  function handleRoll() {
    setError(null);
    syncMarkStarted();
    try {
      const next = engineRoll(gameState, gameState.held);
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

  function handleToggleHold(index: number) {
    const next = engineToggleHold(gameState, index);
    if (next !== gameState) setGameState(next);
  }

  function handleScore(category: string) {
    setError(null);
    try {
      const prev = gameState;
      const alternatives = possibleScores;
      const next = engineScore(prev, category as Category);
      setGameState(next);
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

  const [error, setError] = useState<string | null>(null);

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
        held={gameState.held}
        rollsUsed={gameState.rolls_used}
        gameOver={gameState.game_over}
        onRoll={handleRoll}
        onToggleHold={handleToggleHold}
        rollingIndices={rollingIndices}
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

      <YachtCelebrationAnimation
        visible={showYachtCelebration}
        onDismiss={() => setShowYachtCelebration(false)}
      />

      <YachtCelebrationAnimation
        variant="joker"
        visible={showJokerCelebration}
        onDismiss={() => setShowJokerCelebration(false)}
      />

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

      {__DEV__ && (
        <Pressable style={styles.devButton} onPress={() => setDevPanelOpen(true)}>
          <Text style={styles.devButtonText}>DEV</Text>
        </Pressable>
      )}

      {__DEV__ && (
        <Modal
          visible={devPanelOpen}
          transparent
          animationType="fade"
          accessibilityViewIsModal
          onRequestClose={() => setDevPanelOpen(false)}
        >
          <View style={styles.devOverlay}>
            <View style={[styles.devPanel, { backgroundColor: colors.surfaceHigh }]}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.devScrollContent}
              >
                <Text style={styles.devTitle}>Yacht Dev Panel</Text>

                <Text style={[styles.devSectionHeader, { color: colors.textMuted }]}>
                  ── Dice Override ──
                </Text>
                <Text style={[styles.devHint, { color: colors.textMuted }]}>
                  Applied on next roll. Held dice are respected.
                </Text>

                <View style={styles.devDiceRow}>
                  {devDice.map((val, i) => (
                    <View key={i} style={styles.devDieCell}>
                      <Pressable
                        style={styles.devStepBtn}
                        onPress={() =>
                          setDevDice((d) => {
                            const next = [...d] as typeof d;
                            next[i] = Math.min(6, d[i] + 1);
                            return next;
                          })
                        }
                        accessibilityLabel={`Increase die ${i + 1}`}
                      >
                        <Text style={styles.devStepText}>+</Text>
                      </Pressable>
                      <Text style={styles.devDieValue}>{val}</Text>
                      <Pressable
                        style={styles.devStepBtn}
                        onPress={() =>
                          setDevDice((d) => {
                            const next = [...d] as typeof d;
                            next[i] = Math.max(1, d[i] - 1);
                            return next;
                          })
                        }
                        accessibilityLabel={`Decrease die ${i + 1}`}
                      >
                        <Text style={styles.devStepText}>−</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>

                <Text style={[styles.devSectionHeader, { color: colors.textMuted }]}>
                  ── Presets ──
                </Text>

                {(
                  [
                    ["Yacht", [3, 3, 3, 3, 3]],
                    ["Full House", [2, 2, 2, 5, 5]],
                    ["Sm. Straight", [1, 2, 3, 4, 6]],
                    ["Lg. Straight", [1, 2, 3, 4, 5]],
                    ["All 1s", [1, 1, 1, 1, 1]],
                    ["All 6s", [6, 6, 6, 6, 6]],
                  ] as [string, [number, number, number, number, number]][]
                ).map(([label, preset]) => (
                  <Pressable
                    key={label}
                    style={styles.devPresetBtn}
                    onPress={() => setDevDice(preset)}
                  >
                    <Text style={styles.devPresetText}>
                      {label} [{preset.join(",")}]
                    </Text>
                  </Pressable>
                ))}

                <Pressable
                  style={[styles.devActionBtn, { backgroundColor: "rgba(255,128,0,1)" }]}
                  onPress={() => {
                    setDiceOverride([...devDice]);
                    setDevPanelOpen(false);
                  }}
                >
                  <Text style={styles.devActionPrimaryText}>Apply on next roll</Text>
                </Pressable>

                <Pressable
                  style={[styles.devActionBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
                  onPress={() => setDevPanelOpen(false)}
                >
                  <Text style={[styles.devActionText, { color: colors.textMuted }]}>Close</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
  devButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(255,128,0,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 100,
  },
  devButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  devOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  devPanel: {
    borderRadius: 12,
    padding: 24,
    width: 320,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(255,128,0,0.5)",
  },
  devScrollContent: {
    gap: 12,
  },
  devTitle: {
    color: "rgba(255,128,0,1)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  devSectionHeader: {
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 4,
  },
  devHint: {
    fontSize: 11,
    textAlign: "center",
  },
  devDiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  devDieCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  devStepBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  devStepText: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 22,
  },
  devDieValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  devPresetBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  devPresetText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  devActionBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  devActionPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  devActionText: {
    fontSize: 13,
  },
});
