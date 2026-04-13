import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { AppHeader, APP_HEADER_HEIGHT } from "../components/shared/AppHeader";
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

  /** Blocks new moves while the slide animation plays. */
  const movingRef = useRef(false);
  /** One queued move — fires immediately after the current animation ends. */
  const pendingMove = useRef<Direction | null>(null);

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
    });
    return () => {
      active = false;
    };
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

  const executeMove = useCallback((direction: Direction, currentState: Twenty48State) => {
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
  }, []);

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

  const handleNewGame = useCallback(() => {
    movingRef.current = false;
    pendingMove.current = null;
    setWinDismissed(false);
    const next = newGame();
    setState(next);
    saveGame(next);
  }, []);

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

  if (!state && loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const showWinOverlay = state?.has_won && !winDismissed && !state.game_over;
  const showGameOverOverlay = state?.game_over;

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
      <AppHeader title={t("game.title")} onBack={() => navigation.popToTop()} />

      {/* Score + New Game */}
      <View style={styles.scoreRow}>
        {state && (
          <View style={styles.scoreBoardWrap}>
            <ScoreBoard score={state.score} bestScore={bestScore} scoreDelta={state.scoreDelta} />
          </View>
        )}
        <Pressable
          style={[styles.newGameBtn, { backgroundColor: colors.accent }]}
          onPress={handleNewGame}
          accessibilityRole="button"
          accessibilityLabel={t("twenty48:actions.newGameLabel")}
        >
          <Text
            style={[styles.newGameBtnText, { color: colors.textOnAccent }]}
            numberOfLines={1}
          >
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
          onNewGame={handleNewGame}
          onKeepPlaying={() => setWinDismissed(true)}
          onHome={() => navigation.goBack()}
        />
      )}
      {showGameOverOverlay && (
        <GameOverlay
          type="game_over"
          score={state!.score}
          onNewGame={handleNewGame}
          onHome={() => navigation.goBack()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
  },
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
