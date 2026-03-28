import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { ludoApi, LudoState } from "../api/ludoClient";
import LudoBoard from "../components/ludo/LudoBoard";
import DiceDisplay from "../components/ludo/DiceDisplay";
import PieceSelector from "../components/ludo/PieceSelector";
import PlayerStatus from "../components/ludo/PlayerStatus";
import LudoGameOverModal from "../components/ludo/GameOverModal";

const HUMAN_PLAYER = "red";
const AUTO_MOVE_DELAY_MS = 600;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Ludo">;
};

export default function LudoScreen({ navigation }: Props) {
  const { t } = useTranslation(["ludo", "common", "errors"]);
  const { colors, theme, toggle } = useTheme();

  const [state, setState] = useState<LudoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create session on mount
  useEffect(() => {
    let active = true;
    setLoading(true);
    ludoApi
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
    async (fn: () => Promise<LudoState>) => {
      setLoading(true);
      setError(null);
      try {
        const s = await fn();
        setState(s);
        return s;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("errors:backend.connection"));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  async function handleRoll() {
    const s = await call(ludoApi.roll);
    if (!s) return;

    // Auto-move when only one piece can move
    if (s.phase === "move" && s.valid_moves.length === 1 && s.current_player === HUMAN_PLAYER) {
      autoMoveTimer.current = setTimeout(() => {
        call(() => ludoApi.move(s.valid_moves[0]));
      }, AUTO_MOVE_DELAY_MS);
    }
  }

  async function handleMove(pieceIndex: number) {
    await call(() => ludoApi.move(pieceIndex));
  }

  async function handleNewGame() {
    await call(ludoApi.newGame);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.navigate("Home")}
          accessibilityRole="button"
          accessibilityLabel={t("common:nav.back")}
        >
          <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>‹</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t("ludo:game.title")}
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
            ? t(`ludo:phase.${state.phase}` as Parameters<typeof t>[0])
            : t("ludo:status.cpuTurn")}
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state && (
          <>
            {/* Board */}
            <LudoBoard
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
                {t("ludo:die.noMoves")}
              </Text>
            )}

            {/* Roll button */}
            {showRollBtn && (
              <Pressable
                style={[styles.rollBtn, { backgroundColor: colors.accent }]}
                onPress={handleRoll}
                accessibilityRole="button"
                accessibilityLabel={t("ludo:actions.rollLabel")}
              >
                <Text style={[styles.rollBtnText, { color: colors.surface }]}>
                  {t("ludo:actions.roll")}
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
        <LudoGameOverModal
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
    paddingTop: 48,
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
