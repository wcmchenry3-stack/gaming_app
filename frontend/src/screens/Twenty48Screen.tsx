import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { GameShell } from "../components/shared/GameShell";
import { Twenty48State } from "../game/twenty48/types";
import { newGame, move as engineMove, Direction } from "../game/twenty48/engine";
import {
  saveGame,
  loadGame,
  clearGame,
  saveBestScore,
  loadBestScore,
} from "../game/twenty48/storage";
import Grid from "../components/twenty48/Grid";
import ScoreBoard from "../components/twenty48/ScoreBoard";
import GameOverlay from "../components/twenty48/GameOverlay";
import StatsBento from "../components/twenty48/StatsBento";
import NewGameConfirmModal from "../components/shared/NewGameConfirmModal";
import { gameEventClient } from "../game/_shared/gameEventClient";

function flattenBoard(board: number[][]): number[] {
  return board.flat();
}

function highestTile(board: number[][]): number {
  return Math.max(0, ...board.flat());
}

function computeDurationMs(s: Twenty48State): number {
  return s.accumulatedMs + (s.startedAt !== null ? Date.now() - s.startedAt : 0);
}

const SWIPE_THRESHOLD = 30;
/** How long (ms) to hold the move lock — matches slide animation duration. */
const MOVE_LOCK_MS = 120;

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Twenty48">;
};

export default function Twenty48Screen({ navigation }: Props) {
  const { t } = useTranslation(["twenty48", "common", "errors"]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<Twenty48State | null>(null);
  const [loading, setLoading] = useState(true);
  const [winDismissed, setWinDismissed] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [confirmNewGameVisible, setConfirmNewGameVisible] = useState(false);

  /** Blocks new moves while the slide animation plays. */
  const movingRef = useRef(false);
  /** One queued move — fires immediately after the current animation ends. */
  const pendingMove = useRef<Direction | null>(null);

  // Game event instrumentation (#369). One session per game from load /
  // reset until game_over OR keep-playing. After a keep-playing end, further
  // moves are still playable but aren't tracked — they belong to no session.
  const gameIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const moveCountRef = useRef(0);
  const stateRef = useRef<Twenty48State | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const startInstrumentedSession = useCallback((s: Twenty48State) => {
    moveCountRef.current = 0;
    completedRef.current = false;
    gameIdRef.current = gameEventClient.startGame(
      "twenty48",
      {},
      { initial_board: flattenBoard(s.board) }
    );
  }, []);

  const endedPayload = useCallback(
    (s: Twenty48State, outcome: "completed" | "abandoned" | "kept_playing") => ({
      final_score: s.score,
      highest_tile: highestTile(s.board),
      move_count: moveCountRef.current,
      duration_ms: computeDurationMs(s),
      outcome,
    }),
    []
  );

  const endInstrumentedSession = useCallback(
    (s: Twenty48State, outcome: "completed" | "abandoned" | "kept_playing") => {
      const gid = gameIdRef.current;
      if (!gid || completedRef.current) return;
      gameEventClient.completeGame(
        gid,
        { finalScore: s.score, outcome, durationMs: computeDurationMs(s) },
        endedPayload(s, outcome)
      );
      completedRef.current = true;
    },
    [endedPayload]
  );

  // Disable back swipe gesture on this screen.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  // Load saved game and best score on mount.
  useEffect(() => {
    let active = true;
    Promise.all([loadGame(), loadBestScore()]).then(([saved, best]) => {
      if (!active) return;
      let next = saved ?? newGame();
      // Resume timer when reloading a mid-game state.
      if (!next.game_over && next.startedAt !== null) {
        next = { ...next, startedAt: Date.now() };
      }
      setState(next);
      if (!saved) saveGame(next);
      setBestScore(best);
      setLoading(false);
      if (!next.game_over) {
        startInstrumentedSession(next);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abandon the session on unmount if still open.
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (s && !completedRef.current && gameIdRef.current) {
        endInstrumentedSession(s, "abandoned");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update and persist best score whenever score improves.
  useEffect(() => {
    if (!state) return;
    if (state.score > bestScore) {
      setBestScore(state.score);
      saveBestScore(state.score);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.score]); // intentional: only re-run when score changes, not on every state update

  const executeMove = useCallback(
    (direction: Direction, currentState: Twenty48State) => {
      movingRef.current = true;
      let next: Twenty48State;
      try {
        next = engineMove(currentState, direction);
      } catch {
        // "no effect" or game over — release lock immediately.
        movingRef.current = false;
        pendingMove.current = null;
        return;
      }
      setState(next);
      saveGame(next);
      const gid = gameIdRef.current;
      if (gid && !completedRef.current) {
        moveCountRef.current += 1;
        try {
          gameEventClient.enqueueEvent(gid, {
            type: "move",
            data: {
              direction,
              score_delta: next.scoreDelta,
              score_after: next.score,
              highest_tile_after: highestTile(next.board),
              is_game_over: next.game_over,
              has_won: next.has_won,
            },
          });
          if (next.game_over) {
            endInstrumentedSession(next, "completed");
          }
        } catch {
          // Isolation: instrumentation failures must never block gameplay.
        }
      }
      // Hold the lock for the slide animation duration, then fire any queued move.
      setTimeout(() => {
        movingRef.current = false;
        const queued = pendingMove.current;
        pendingMove.current = null;
        if (queued) {
          setState((s) => {
            if (s) executeMove(queued, s);
            return s;
          });
        }
      }, MOVE_LOCK_MS);
    },
    [endInstrumentedSession]
  );

  const handleMove = useCallback(
    (direction: Direction) => {
      if (!state || state.game_over) return;
      if (movingRef.current) {
        pendingMove.current = direction;
        return;
      }
      executeMove(direction, state);
    },
    [state, executeMove]
  );

  const resetGame = useCallback(() => {
    movingRef.current = false;
    pendingMove.current = null;
    setWinDismissed(false);
    // Close out the previous session if it's still open.
    const prev = stateRef.current;
    if (prev && !completedRef.current && gameIdRef.current) {
      endInstrumentedSession(prev, prev.game_over ? "completed" : "abandoned");
    }
    const next = newGame();
    setState(next);
    saveGame(next);
    startInstrumentedSession(next);
  }, [endInstrumentedSession, startInstrumentedSession]);

  const handleNewGamePress = useCallback(() => {
    if (state && state.score > 0 && !state.game_over) {
      setConfirmNewGameVisible(true);
    } else {
      resetGame();
    }
  }, [state, resetGame]);

  const handleConfirmNewGame = useCallback(() => {
    setConfirmNewGameVisible(false);
    resetGame();
  }, [resetGame]);

  // When game ends, remove the saved state so a fresh game starts next launch.
  useEffect(() => {
    if (state?.game_over) clearGame();
  }, [state?.game_over]);

  // Web keyboard controls — arrow keys + WASD.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const keyMap: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right",
    };
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      const direction = keyMap[e.key];
      if (!direction) return;
      e.preventDefault();
      handleMove(direction);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleMove]);

  // Blur filter for ambient glow blobs — web only (native uses opacity alone).
  const glowBlur = Platform.OS === "web" ? ({ filter: "blur(80px)" } as object) : undefined;

  const swipeGesture = Gesture.Pan()
    .minDistance(SWIPE_THRESHOLD)
    .onEnd((e) => {
      const { translationX, translationY } = e;
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);
      if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return;
      let direction: Direction;
      if (absX > absY) {
        direction = translationX > 0 ? "right" : "left";
      } else {
        direction = translationY > 0 ? "down" : "up";
      }
      handleMove(direction);
    })
    .runOnJS(true);

  const showWinOverlay = state?.has_won && !winDismissed && !state.game_over;
  const showGameOverOverlay = state?.game_over;

  return (
    <GameShell
      title={t("game.title")}
      requireBack
      onBack={() => navigation.popToTop()}
      loading={!state && loading}
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 16),
        paddingRight: Math.max(insets.right, 16),
        alignItems: "center",
      }}
    >
      {/* Score + New Game */}
      <View style={styles.scoreRow}>
        {state && (
          <View style={styles.scoreBoardWrap}>
            <ScoreBoard score={state.score} bestScore={bestScore} scoreDelta={state.scoreDelta} />
          </View>
        )}
        <Pressable
          style={[styles.newGameBtn, { backgroundColor: colors.accent }]}
          onPress={handleNewGamePress}
          accessibilityRole="button"
          accessibilityLabel={t("twenty48:actions.newGameLabel")}
        >
          <Text style={[styles.newGameBtnText, { color: colors.textOnAccent }]} numberOfLines={1}>
            {t("twenty48:actions.newGame")}
          </Text>
        </Pressable>
      </View>

      {/* Swipe hint */}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t("twenty48:swipe.hint")}</Text>
      {Platform.OS === "web" && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t("twenty48:controls.keyboardHint")}
        </Text>
      )}

      {/* Board */}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.boardContainer}>
          {/* Ambient glow blobs — decorative, placed behind the grid */}
          <View
            style={[styles.glowTopLeft, { backgroundColor: colors.accent }, glowBlur]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          />
          <View
            style={[styles.glowBottomRight, { backgroundColor: colors.secondary }, glowBlur]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          />
          {state && <Grid tiles={state.tiles} />}
        </View>
      </GestureDetector>

      {/* Stats bento — Highest Tile + Time Played */}
      {state && <StatsBento state={state} />}

      {/* Overlays */}
      {showWinOverlay && (
        <GameOverlay
          type="win"
          score={state!.score}
          onNewGame={resetGame}
          onKeepPlaying={() => {
            setWinDismissed(true);
            const s = stateRef.current;
            if (s) endInstrumentedSession(s, "kept_playing");
          }}
          onHome={() => navigation.goBack()}
        />
      )}
      {showGameOverOverlay && (
        <GameOverlay
          type="game_over"
          score={state!.score}
          onNewGame={resetGame}
          onHome={() => navigation.goBack()}
        />
      )}

      <NewGameConfirmModal
        visible={confirmNewGameVisible}
        onConfirm={handleConfirmNewGame}
        onCancel={() => setConfirmNewGameVisible(false)}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    width: "100%",
    maxWidth: 360,
  },
  scoreBoardWrap: {
    flex: 1,
    minWidth: 0,
  },
  newGameBtn: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  newGameBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    marginBottom: 12,
  },
  boardContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glowTopLeft: {
    position: "absolute",
    width: 192,
    height: 192,
    top: -24,
    left: -24,
    borderRadius: 96,
    opacity: 0.1,
  },
  glowBottomRight: {
    position: "absolute",
    width: 192,
    height: 192,
    bottom: -24,
    right: -24,
    borderRadius: 96,
    opacity: 0.1,
  },
  error: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
});
