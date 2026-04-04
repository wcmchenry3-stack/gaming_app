import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { twenty48Api, Twenty48State } from "../api/twenty48Client";
import Grid from "../components/twenty48/Grid";
import ScoreBoard from "../components/twenty48/ScoreBoard";
import GameOverlay from "../components/twenty48/GameOverlay";

const SWIPE_THRESHOLD = 30;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Twenty48">;
};

export default function Twenty48Screen({ navigation }: Props) {
  const { t } = useTranslation(["twenty48", "common", "errors"]);
  const { colors, theme, toggle } = useTheme();

  const [state, setState] = useState<Twenty48State | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const movingRef = useRef(false);

  // Disable back swipe gesture on this screen
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  // Create session on mount
  useEffect(() => {
    let active = true;
    setLoading(true);
    twenty48Api
      .newSession()
      .then((s) => {
        if (active) setState(s);
      })
      .catch(() => {
        if (active) setError(t("errors:backend.connection"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const call = useCallback(
    async (fn: () => Promise<Twenty48State>) => {
      setLoading(true);
      setError(null);
      try {
        const s = await fn();
        setState(s);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("errors:backend.connection"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const handleMove = useCallback(
    async (direction: string) => {
      if (movingRef.current || !state || state.game_over) return;
      movingRef.current = true;
      try {
        await call(() => twenty48Api.move(direction));
      } finally {
        movingRef.current = false;
      }
    },
    [call, state]
  );

  const handleNewGame = useCallback(async () => {
    setWinDismissed(false);
    await call(twenty48Api.newSession);
  }, [call]);

  const swipeGesture = Gesture.Pan()
    .minDistance(SWIPE_THRESHOLD)
    .onEnd((e) => {
      const { translationX, translationY } = e;
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);

      if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return;

      let direction: string;
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.navigate("Home")}
          accessibilityRole="button"
          accessibilityLabel={t("common:nav.back")}
        >
          <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>&#x2039;</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>{t("twenty48:game.title")}</Text>

        <Pressable
          style={styles.headerBtn}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={t("common:theme.switchTo", {
            mode: theme === "dark" ? t("common:theme.light") : t("common:theme.dark"),
          })}
        >
          <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>
            {theme === "dark" ? t("common:theme.light") : t("common:theme.dark")}
          </Text>
        </Pressable>
      </View>

      {/* Score + New Game */}
      <View style={styles.scoreRow}>
        {state && <ScoreBoard score={state.score} />}
        <Pressable
          style={[styles.newGameBtn, { backgroundColor: colors.accent }]}
          onPress={handleNewGame}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={t("twenty48:actions.newGameLabel")}
        >
          <Text style={[styles.newGameBtnText, { color: colors.surface }]}>
            {t("twenty48:actions.newGame")}
          </Text>
        </Pressable>
      </View>

      {/* Swipe hint */}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t("twenty48:swipe.hint")}</Text>

      {/* Board */}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.boardContainer}>{state && <Grid board={state.board} />}</View>
      </GestureDetector>

      {/* Error */}
      {error && !error.includes("no effect") && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}

      {/* Overlays */}
      {showWinOverlay && (
        <GameOverlay
          type="win"
          score={state!.score}
          onNewGame={handleNewGame}
          onKeepPlaying={() => setWinDismissed(true)}
          onHome={() => navigation.navigate("Home")}
        />
      )}
      {showGameOverOverlay && (
        <GameOverlay
          type="game_over"
          score={state!.score}
          onNewGame={handleNewGame}
          onHome={() => navigation.navigate("Home")}
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
    paddingTop: 48,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 17,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  newGameBtn: {
    paddingHorizontal: 16,
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
  },
  error: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
});
