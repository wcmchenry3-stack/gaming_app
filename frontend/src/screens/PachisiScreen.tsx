import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { pachisiApi, PachisiState } from "../game/pachisi/api";
import { ApiError } from "../game/_shared/httpClient";
import PachisiBoard from "../components/pachisi/PachisiBoard";
import DiceDisplay from "../components/pachisi/DiceDisplay";
import PieceSelector from "../components/pachisi/PieceSelector";
import PlayerStatus from "../components/pachisi/PlayerStatus";
import PachisiGameOverModal from "../components/pachisi/GameOverModal";

const HUMAN_PLAYER = "red";
const AUTO_MOVE_DELAY_MS = 600;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Pachisi">;
};

export default function PachisiScreen({ navigation }: Props) {
  const { t } = useTranslation(["pachisi", "common", "errors"]);
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<PachisiState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create session on mount
  useEffect(() => {
    let active = true;
    setLoading(true);
    pachisiApi
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
      if (autoMoveTimer.current) clearTimeout(autoMoveTimer.current);
    };
  }, [t]);

  const call = useCallback(
    async (fn: () => Promise<PachisiState>) => {
      setLoading(true);
      setError(null);
      try {
        const s = await fn();
        setState(s);
        return s;
      } catch (e: unknown) {
        // Session expired / not found — silently create a new one
        if (e instanceof ApiError && e.status === 404) {
          try {
            const s = await pachisiApi.newSession();
            setState(s);
            return s;
          } catch {
            setError(t("errors:backend.connection"));
            return null;
          }
        }
        setError(e instanceof Error ? e.message : t("errors:backend.connection"));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  async function handleRoll() {
    const s = await call(pachisiApi.roll);
    if (!s) return;

    // Auto-move when only one piece can move
    if (s.phase === "move" && s.valid_moves.length === 1 && s.current_player === HUMAN_PLAYER) {
      autoMoveTimer.current = setTimeout(() => {
        call(() => pachisiApi.move(s.valid_moves[0]));
      }, AUTO_MOVE_DELAY_MS);
    }
  }

  async function handleMove(pieceIndex: number) {
    await call(() => pachisiApi.move(pieceIndex));
  }

  async function handleNewGame() {
    await call(pachisiApi.newGame);
  }

  const isHumanTurn = state?.current_player === HUMAN_PLAYER;
  const showRollBtn = state?.phase === "roll" && isHumanTurn && !loading;
  const showSelector =
    state?.phase === "move" && isHumanTurn && (state.valid_moves?.length ?? 0) > 1 && !loading;

  if (!state && loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16), paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("common:nav.backLabel")}
        >
          <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>‹</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t("pachisi:game.title")}
        </Text>

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

      {/* Phase label */}
      {state && (
        <Text style={[styles.phaseLabel, { color: colors.textMuted }]}>
          {isHumanTurn
            ? t(`pachisi:phase.${state.phase}` as Parameters<typeof t>[0])
            : t("pachisi:status.cpuTurn")}
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state && (
          <>
            {/* Board */}
            <PachisiBoard
              playerStates={state.player_states}
              validMoves={state.valid_moves}
              currentPlayer={state.current_player}
              humanPlayer={HUMAN_PLAYER}
              phase={state.phase}
              onPiecePress={handleMove}
            />

            {/* Player status */}
            <PlayerStatus
              playerStates={state.player_states}
              currentPlayer={state.current_player}
              humanPlayer={HUMAN_PLAYER}
            />

            {/* Die display */}
            {state.die_value != null && (
              <DiceDisplay value={state.die_value} extraTurn={state.extra_turn} />
            )}

            {/* No-moves notice */}
            {state.last_event === "no_moves" && (
              <Text style={[styles.notice, { color: colors.textMuted }]}>
                {t("pachisi:die.noMoves")}
              </Text>
            )}

            {/* Roll button */}
            {showRollBtn && (
              <Pressable
                style={[styles.rollBtn, { backgroundColor: colors.accent }]}
                onPress={handleRoll}
                accessibilityRole="button"
                accessibilityLabel={t("pachisi:actions.rollLabel")}
              >
                <Text style={[styles.rollBtnText, { color: colors.surface }]}>
                  {t("pachisi:actions.roll")}
                </Text>
              </Pressable>
            )}

            {/* Piece selector (shown when multiple pieces can move) */}
            {showSelector && (
              <PieceSelector
                validMoves={state.valid_moves}
                playerColor={HUMAN_PLAYER}
                onSelect={handleMove}
                loading={loading}
              />
            )}

            {/* Error display */}
            {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
          </>
        )}
      </ScrollView>

      {/* Game over modal */}
      {state && (
        <PachisiGameOverModal
          visible={state.phase === "game_over"}
          winner={state.winner}
          humanPlayer={HUMAN_PLAYER}
          onPlayAgain={handleNewGame}
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  phaseLabel: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  content: {
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  notice: {
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
  },
  rollBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  rollBtnText: {
    fontSize: 18,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    textAlign: "center",
  },
});
