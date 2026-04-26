/**
 * MahjongScreen — Mahjong Solitaire with full lifecycle wiring (#874).
 *
 * Concerns:
 *   1. Game logic — dispatches engine functions (selectTile, shuffleBoard,
 *      undoMove) in response to GameCanvas callbacks; engine is pure and
 *      replaces state wholesale on every transition.
 *   2. Persistence — AsyncStorage save/resume on every mutation.
 *   3. Instrumentation — useGameSync session started on first tile tap,
 *      completed on win, abandoned on back-navigation.
 *   4. Score submission — scoreQueue.enqueue("mahjong", …) on win; never
 *      calls mahjongApi.submitScore directly.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { HomeStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { typography } from "../theme/typography";
import { GameShell } from "../components/shared/GameShell";
import { OfflineBanner } from "../components/shared/OfflineBanner";
import GameCanvas, { BOARD_W, BOARD_H } from "../components/mahjong/GameCanvas";
import { createGame, elapsedMs, selectTile, shuffleBoard, undoMove } from "../game/mahjong/engine";
import { TURTLE_LAYOUT } from "../game/mahjong/layouts/turtle";
import type { MahjongState } from "../game/mahjong/types";
import {
  clearGame,
  loadGame,
  loadStats,
  saveGame,
  saveStats,
  type MahjongStats,
} from "../game/mahjong/storage";
import { useMahjongScoreboard } from "../game/mahjong/MahjongScoreboardContext";
import { scoreQueue } from "../game/_shared/scoreQueue";
import { useGameSync } from "../game/_shared/useGameSync";
import { useNetwork } from "../game/_shared/NetworkContext";

const MAX_NAME_LENGTH = 32;

export default function MahjongScreen() {
  const { t } = useTranslation("mahjong");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const [state, setState] = useState<MahjongState | null>(null);
  const [loading, setLoading] = useState(true);
  const [outerWidth, setOuterWidth] = useState(0);
  const [stats, setStats] = useState<MahjongStats>({
    bestScore: 0,
    bestTimeMs: 0,
    gamesPlayed: 0,
    gamesWon: 0,
  });

  const hasLoadedRef = useRef(false);
  const stateRef = useRef<MahjongState | null>(null);
  const winRecordedRef = useRef(false);
  const prevCompleteRef = useRef(false);

  const {
    start: syncStart,
    markStarted: syncMarkStarted,
    complete: syncComplete,
    getGameId: syncGetGameId,
  } = useGameSync("mahjong");

  const { setSnapshot: setScoreboardSnapshot } = useMahjongScoreboard();

  // Scoreboard snapshot — updated on every state change.
  useEffect(() => {
    if (!state) return;
    const elapsed = elapsedMs(state, Date.now());
    setScoreboardSnapshot({
      score: state.score,
      pairsRemoved: state.pairsRemoved,
      shufflesLeft: state.shufflesLeft,
      elapsedMs: elapsed,
      hasGame: true,
      bestScore: stats.bestScore,
      bestTimeMs: stats.bestTimeMs,
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
    });
  }, [state, stats, setScoreboardSnapshot]);

  // Mount: restore saved game or deal fresh.
  useEffect(() => {
    let alive = true;
    Promise.all([loadGame(), loadStats()]).then(([saved, savedStats]) => {
      if (!alive) return;
      hasLoadedRef.current = true;
      if (saved !== null) {
        setState(saved);
        if (saved.isComplete) winRecordedRef.current = true;
      } else {
        setState(createGame(TURTLE_LAYOUT));
        setStats((prev) => {
          const updated = { ...prev, gamesPlayed: prev.gamesPlayed + 1 };
          saveStats(updated).catch(() => {});
          return updated;
        });
      }
      setStats(savedStats);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist on every state change after mount load resolves.
  useEffect(() => {
    stateRef.current = state;
    if (!hasLoadedRef.current || state === null) return;
    saveGame(state).catch(() => {});
  }, [state]);

  // Win lifecycle: complete sync session, record stats.
  useEffect(() => {
    if (state === null) {
      prevCompleteRef.current = false;
      return;
    }
    if (state.isComplete && !prevCompleteRef.current) {
      syncComplete(
        { finalScore: state.score, outcome: "completed", durationMs: state.accumulatedMs },
        { final_score: state.score, outcome: "completed", pairs: state.pairsRemoved }
      );
      clearGame().catch(() => {});
      if (!winRecordedRef.current) {
        winRecordedRef.current = true;
        const finalMs = state.accumulatedMs;
        const finalScore = state.score;
        setStats((prev) => {
          const updated: MahjongStats = {
            ...prev,
            gamesWon: prev.gamesWon + 1,
            bestScore: finalScore > prev.bestScore ? finalScore : prev.bestScore,
            bestTimeMs:
              prev.bestTimeMs === 0 || finalMs < prev.bestTimeMs ? finalMs : prev.bestTimeMs,
          };
          saveStats(updated).catch(() => {});
          return updated;
        });
      }
    }
    prevCompleteRef.current = state.isComplete;
  }, [state, syncComplete]);

  // Abandon on back-navigation.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      if (!syncGetGameId()) return;
      const s = stateRef.current;
      if (s?.isComplete) return;
      syncComplete(
        { outcome: "abandoned", finalScore: s?.score ?? 0, durationMs: 0 },
        { outcome: "abandoned" }
      );
    });
    return unsub;
  }, [navigation, syncComplete, syncGetGameId]);

  const ensureSyncStarted = useCallback(
    (s: MahjongState) => {
      if (syncGetGameId()) return;
      syncStart({ layout: "turtle" });
      syncMarkStarted();
      // Count the new game on the first real action (first tile tap).
      if (s.pairsRemoved === 0 && !hasLoadedRef.current) return;
    },
    [syncGetGameId, syncStart, syncMarkStarted]
  );

  const handleTilePress = useCallback(
    (tileId: number) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = selectTile(prev, tileId);
        if (next === prev) return prev;
        ensureSyncStarted(next);
        return next;
      });
    },
    [ensureSyncStarted]
  );

  const handleShuffle = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const next = shuffleBoard(prev);
      if (next === prev) return prev;
      ensureSyncStarted(next);
      return next;
    });
  }, [ensureSyncStarted]);

  const handleUndo = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      return undoMove(prev);
    });
  }, []);

  const startNewGame = useCallback(() => {
    winRecordedRef.current = false;
    prevCompleteRef.current = false;
    const fresh = createGame(TURTLE_LAYOUT);
    setState(fresh);
    setStats((prev) => {
      const updated = { ...prev, gamesPlayed: prev.gamesPlayed + 1 };
      saveStats(updated).catch(() => {});
      return updated;
    });
    // Abandon any open session before starting a new one.
    if (syncGetGameId()) {
      syncComplete(
        { outcome: "abandoned", finalScore: 0, durationMs: 0 },
        { outcome: "abandoned" }
      );
    }
    syncStart({ layout: "turtle" });
    syncMarkStarted();
  }, [syncGetGameId, syncComplete, syncStart, syncMarkStarted]);

  const scale = outerWidth > 0 ? Math.min(1, outerWidth / BOARD_W) : 1;

  const onOuterLayout = useCallback((e: LayoutChangeEvent) => {
    setOuterWidth(Math.floor(e.nativeEvent.layout.width));
  }, []);

  const undoDisabled = !state || state.undoStack.length === 0 || state.isComplete;

  return (
    <GameShell
      title={t("game.title")}
      requireBack
      loading={loading}
      onBack={() => navigation.popToTop()}
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 12),
        paddingRight: Math.max(insets.right, 12),
      }}
      onNewGame={startNewGame}
      onOpenScoreboard={() => navigation.navigate("Scoreboard", { gameKey: "mahjong" })}
      rightSlot={
        <Pressable
          onPress={handleUndo}
          disabled={undoDisabled}
          style={[
            styles.headerBtn,
            { borderColor: colors.accent, opacity: undoDisabled ? 0.4 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("action.undoLabel")}
          accessibilityState={{ disabled: undoDisabled }}
        >
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>{t("action.undo")}</Text>
        </Pressable>
      }
    >
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        onLayout={onOuterLayout}
        showsVerticalScrollIndicator={false}
      >
        {state !== null && (
          <>
            <View style={styles.hudRow} accessibilityRole="summary">
              <Text style={[styles.hudText, { color: colors.text }]}>
                {t("hud.score")} {state.score}
              </Text>
              <Text style={[styles.hudText, { color: colors.textMuted }]}>
                {t("hud.pairs")} {state.pairsRemoved}/72
              </Text>
              <Text style={[styles.hudText, { color: colors.textMuted }]}>
                {t("action.shuffle")} {state.shufflesLeft}
              </Text>
            </View>

            <View style={[styles.boardWrap, outerWidth > 0 ? { height: BOARD_H * scale } : null]}>
              <View style={[styles.board, { width: BOARD_W, transform: [{ scale }] } as ViewStyle]}>
                <GameCanvas
                  state={state}
                  onTilePress={handleTilePress}
                  onShufflePress={handleShuffle}
                  onNewGamePress={startNewGame}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {state?.isComplete && (
        <WinModal score={state.score} pairsRemoved={state.pairsRemoved} onNewGame={startNewGame} />
      )}
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Win modal — name entry + ScoreQueue submission
// ---------------------------------------------------------------------------

function WinModal({
  score,
  pairsRemoved,
  onNewGame,
}: {
  readonly score: number;
  readonly pairsRemoved: number;
  readonly onNewGame: () => void;
}) {
  const { t } = useTranslation("mahjong");
  const { colors } = useTheme();
  const { isOnline, isInitialized } = useNetwork();

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offline = isInitialized && !isOnline;
  const trimmed = name.trim();
  const canSubmit = !submitting && !offline && trimmed.length > 0;

  const gradient: ViewStyle =
    Platform.OS === "web"
      ? ({
          backgroundImage: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`,
        } as ViewStyle)
      : { backgroundColor: colors.accentBright };

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await scoreQueue.enqueue("mahjong", { player_name: trimmed, score });
      setSubmitted(true);
      scoreQueue.flush().catch(() => undefined);
    } catch {
      setError(t("error.submitFailed", { defaultValue: "Couldn't save score. Tap to retry." }));
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = error
    ? t("error.submitRetry", { defaultValue: "Retry" })
    : t("action.submitScore", { defaultValue: "Submit Score" });

  return (
    <Modal visible transparent animationType="fade" accessibilityViewIsModal>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]} accessibilityRole="header">
            {t("overlay.youWon")}
          </Text>
          <Text style={[styles.modalBody, { color: colors.textMuted }]}>
            {t("overlay.youWonDetail", { count: pairsRemoved })}
          </Text>
          <Text style={[styles.modalScore, { color: colors.text }]}>
            {t("score.display", { score })}
          </Text>

          {!submitted ? (
            <>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={t("win.namePlaceholder", { defaultValue: "Your name" })}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                maxLength={MAX_NAME_LENGTH}
                editable={!submitting}
                accessibilityLabel={t("win.nameLabel", { defaultValue: "Enter your name" })}
              />
              {offline ? (
                <OfflineBanner />
              ) : (
                error !== null && (
                  <Text
                    style={[styles.errorText, { color: colors.error }]}
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                  >
                    {error}
                  </Text>
                )
              )}
              <Pressable
                style={[styles.modalPrimary, gradient, !canSubmit && styles.modalPrimaryDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={submitLabel}
                accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <Text style={[styles.modalPrimaryText, { color: colors.textOnAccent }]}>
                    {submitLabel}
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <Text
              style={[styles.submittedText, { color: colors.bonus }]}
              accessibilityLiveRegion="polite"
            >
              {t("win.submitted", { defaultValue: "Score saved! 🎉" })}
            </Text>
          )}

          <Pressable
            style={[styles.modalSecondary, { borderColor: colors.accent }]}
            onPress={onNewGame}
            accessibilityRole="button"
            accessibilityLabel={t("action.newGameLabel")}
          >
            <Text style={[styles.modalSecondaryText, { color: colors.accent }]}>
              {t("action.newGame")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  hudText: {
    fontFamily: typography.heading,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  boardWrap: {
    alignSelf: "stretch",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  board: {
    alignSelf: "flex-start",
    transformOrigin: "top left",
  } as ViewStyle,
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000bf",
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    width: "86%",
    maxWidth: 360,
  },
  modalTitle: {
    fontFamily: typography.heading,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    textAlign: "center",
  },
  modalScore: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    fontVariant: ["tabular-nums"],
  },
  nameInput: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  submittedText: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalPrimary: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 10,
    alignItems: "center",
    minWidth: 180,
  },
  modalPrimaryDisabled: {
    opacity: 0.5,
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  modalSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
