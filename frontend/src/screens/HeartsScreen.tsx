import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";
import type { Colors } from "../theme/ThemeContext";
import { GameShell } from "../components/shared/GameShell";
import OpponentHand from "../components/hearts/OpponentHand";
import PassingOverlay from "../components/hearts/PassingOverlay";
import PlayerHand from "../components/hearts/PlayerHand";
import ScoreBoard from "../components/hearts/ScoreBoard";
import TrickArea from "../components/hearts/TrickArea";
import {
  commitPass,
  dealGame,
  dealNextHand,
  detectMoon,
  getValidPlays,
  playCard,
  selectPassCard,
} from "../game/hearts/engine";
import { selectCardToPlay, selectCardsToPass } from "../game/hearts/ai";
import { clearGame, loadGame, saveGame } from "../game/hearts/storage";
import { heartsApi } from "../game/hearts/api";
import { useGameSync } from "../game/_shared/useGameSync";
import type { Card, HeartsState, TrickCard } from "../game/hearts/types";

const HUMAN = 0;
const MAX_NAME_LENGTH = 32;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LastTrick = { readonly trick: readonly TrickCard[]; readonly winnerIndex: number } | null;
type SubmitState = "idle" | "submitting" | "done" | "error";

// Compact face-down card stack for narrow side slots.
function CompactHand({
  cardCount,
  label,
  colors,
}: {
  cardCount: number;
  label: string;
  colors: Colors;
}) {
  return (
    <View style={compactStyles.container}>
      <Text style={[compactStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[
          compactStyles.cardBack,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[compactStyles.count, { color: colors.textMuted }]}>{cardCount}</Text>
      </View>
    </View>
  );
}

const compactStyles = StyleSheet.create({
  container: { alignItems: "center", gap: 4 },
  label: { fontSize: 11, fontWeight: "600" },
  cardBack: {
    width: 36,
    height: 52,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { fontSize: 13, fontWeight: "700" },
});

export default function HeartsScreen() {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [gameState, setGameState] = useState<HeartsState>(() => dealGame());
  const [lastTrick, setLastTrick] = useState<LastTrick>(null);
  const [showScores, setShowScores] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const unmountedRef = useRef(false);
  const loopActiveRef = useRef(false);
  const syncStartedRef = useRef(false);
  const gameStateRef = useRef<HeartsState>(gameState);

  const { start: syncStart, complete: syncComplete } = useGameSync("hearts");

  // Keep ref in sync for use in event listeners.
  useEffect(() => {
    gameStateRef.current = gameState;
  });

  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    []
  );

  // ─── Load saved game on mount ──────────────────────────────────────────────
  useEffect(() => {
    loadGame().then((saved) => {
      if (saved && !unmountedRef.current) setGameState(saved);
    });
  }, []);

  // ─── Abandon on back-navigation ───────────────────────────────────────────
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      if (!syncStartedRef.current) return;
      if (gameStateRef.current.isComplete) return;
      syncComplete(
        { outcome: "abandoned", finalScore: 0, durationMs: 0 },
        { outcome: "abandoned" }
      );
      syncStartedRef.current = false;
    });
    return unsub;
  }, [navigation, syncComplete]);

  const playerLabels = [t("player.you"), t("player.left"), t("player.top"), t("player.right")];

  // ─── Start sync on first card play ────────────────────────────────────────
  function ensureSyncStarted() {
    if (syncStartedRef.current) return;
    syncStartedRef.current = true;
    syncStart({ initial_score: 0 });
  }

  // ─── AI turn loop ─────────────────────────────────────────────────────────
  const runAiTurns = useCallback(async (initial: HeartsState) => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;
    try {
      let s = initial;
      while (s.currentPlayerIndex !== HUMAN && s.phase === "playing") {
        const willComplete = s.currentTrick.length === 3;
        await delay(400);
        if (unmountedRef.current) return;

        const card = selectCardToPlay(s, s.currentPlayerIndex);
        const completedTrick: readonly TrickCard[] | null = willComplete
          ? [...s.currentTrick, { card, playerIndex: s.currentPlayerIndex }]
          : null;

        s = playCard(s, s.currentPlayerIndex, card);

        if (completedTrick) {
          setLastTrick({ trick: completedTrick, winnerIndex: s.currentLeaderIndex });
          void saveGame(s);
        }
        setGameState(s);

        if (completedTrick && s.phase === "playing") {
          await delay(1500);
          if (unmountedRef.current) return;
          setLastTrick(null);
        }
      }
    } finally {
      loopActiveRef.current = false;
    }
  }, []);

  // Trigger AI loop when it's their turn; wait for lastTrick display first.
  useEffect(() => {
    if (gameState.phase !== "playing") return;
    if (gameState.currentPlayerIndex === HUMAN) return;
    if (lastTrick !== null) return;
    void runAiTurns(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.tricksPlayedInHand, lastTrick]);

  // Complete sync when game is over.
  useEffect(() => {
    if (gameState.phase !== "game_over") return;
    if (!syncStartedRef.current) return;
    const humanScore = gameState.cumulativeScores[HUMAN] ?? 0;
    const finalScore = Math.max(0, 100 - humanScore);
    syncComplete({ outcome: "completed", finalScore, durationMs: 0 }, { final_score: finalScore });
    syncStartedRef.current = false;
  }, [gameState.phase, gameState.cumulativeScores, syncComplete]);

  // ─── Human card play ──────────────────────────────────────────────────────
  function handleCardPress(card: Card) {
    if (gameState.currentPlayerIndex !== HUMAN || gameState.phase !== "playing") return;
    ensureSyncStarted();
    const willComplete = gameState.currentTrick.length === 3;
    const completedTrick: readonly TrickCard[] | null = willComplete
      ? [...gameState.currentTrick, { card, playerIndex: HUMAN }]
      : null;

    const newState = playCard(gameState, HUMAN, card);

    if (completedTrick) {
      void saveGame(newState);
      if (newState.phase === "playing") {
        setLastTrick({ trick: completedTrick, winnerIndex: newState.currentLeaderIndex });
        setGameState(newState);
        setTimeout(() => {
          if (!unmountedRef.current) setLastTrick(null);
        }, 1500);
        return;
      }
    }
    setLastTrick(null);
    setGameState(newState);
  }

  // ─── Passing ──────────────────────────────────────────────────────────────
  function handlePassCardPress(card: Card) {
    setGameState(selectPassCard(gameState, HUMAN, card));
  }

  function handlePassConfirm() {
    let s = gameState;
    for (let i = 1; i <= 3; i++) {
      const aiCards = selectCardsToPass([...(s.playerHands[i] ?? [])], s.passDirection);
      for (const c of aiCards) {
        s = selectPassCard(s, i, c);
      }
    }
    setGameState(commitPass(s));
  }

  // ─── Hand end / next hand ─────────────────────────────────────────────────
  function handleNextHand() {
    setLastTrick(null);
    const next = dealNextHand(gameState);
    setGameState(next);
    void saveGame(next);
  }

  // ─── Game over / play again ───────────────────────────────────────────────
  async function handleSubmitScore() {
    if (!playerName.trim() || submitState === "submitting" || submitState === "done") return;
    setSubmitState("submitting");
    const humanScore = gameState.cumulativeScores[HUMAN] ?? 0;
    const score = Math.max(0, 100 - humanScore);
    try {
      await heartsApi.submitScore(playerName.trim(), score);
      setSubmitState("done");
    } catch {
      setSubmitState("error");
    }
  }

  function handlePlayAgain() {
    setLastTrick(null);
    setSubmitState("idle");
    setPlayerName("");
    loopActiveRef.current = false;
    syncStartedRef.current = false;
    clearGame().catch(() => {});
    const fresh = dealGame();
    setGameState(fresh);
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const humanHand = [...(gameState.playerHands[HUMAN] ?? [])];
  const validCards =
    gameState.phase === "playing" && gameState.currentPlayerIndex === HUMAN
      ? getValidPlays(gameState, HUMAN)
      : [];
  const displayTrick = lastTrick !== null ? lastTrick.trick : gameState.currentTrick;
  const trickWinnerIndex = lastTrick !== null ? lastTrick.winnerIndex : null;
  const moonShooter = detectMoon(gameState.wonCards);
  const dangerIndex = gameState.cumulativeScores.reduce(
    (maxIdx, s, i, arr) => ((s ?? 0) > (arr[maxIdx] ?? 0) ? i : maxIdx),
    0
  );

  const rightSlot = (
    <Pressable
      onPress={() => setShowScores(true)}
      accessibilityRole="button"
      accessibilityLabel={t("score.board")}
      style={styles.headerBtn}
    >
      <Text style={[styles.headerBtnText, { color: colors.accent }]}>{t("score.board")}</Text>
    </Pressable>
  );

  return (
    <GameShell title={t("game.title")} onBack={() => navigation.goBack()} rightSlot={rightSlot}>
      {/* ── Table ──────────────────────────────────────────────────── */}
      <View style={[styles.table, { backgroundColor: colors.background }]}>
        {/* Top AI (seat 2) */}
        <View style={styles.topArea}>
          <OpponentHand
            cardCount={gameState.playerHands[2]?.length ?? 0}
            label={playerLabels[2] ?? ""}
          />
        </View>

        {/* Middle: Left AI | TrickArea | Right AI */}
        <View style={styles.middleRow}>
          <CompactHand
            cardCount={gameState.playerHands[1]?.length ?? 0}
            label={playerLabels[1] ?? ""}
            colors={colors}
          />
          <TrickArea
            trick={[...displayTrick]}
            playerIndex={HUMAN}
            playerLabels={playerLabels}
            winnerIndex={trickWinnerIndex}
          />
          <CompactHand
            cardCount={gameState.playerHands[3]?.length ?? 0}
            label={playerLabels[3] ?? ""}
            colors={colors}
          />
        </View>

        {/* Human hand */}
        <View style={styles.bottomArea}>
          <PlayerHand hand={humanHand} validCards={validCards} onCardPress={handleCardPress} />
        </View>
      </View>

      {/* ── Passing overlay ────────────────────────────────────────── */}
      {gameState.phase === "passing" && (
        <PassingOverlay
          hand={humanHand}
          passDirection={gameState.passDirection}
          selectedCards={[...(gameState.passSelections[HUMAN] ?? [])]}
          onCardPress={handlePassCardPress}
          onConfirm={handlePassConfirm}
        />
      )}

      {/* ── Hand-end overlay (dealing phase = hand just finished) ──── */}
      {gameState.phase === "dealing" && (
        <Modal visible transparent animationType="fade" accessibilityViewIsModal>
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <View
              style={[
                styles.panel,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.panelTitle, { color: colors.text }]}>{t("hand_end.title")}</Text>
              {moonShooter !== null && (
                <Text style={[styles.moonText, { color: colors.accent }]}>
                  {t("hand_end.moon", { label: playerLabels[moonShooter] ?? "" })}
                </Text>
              )}
              <ScoreBoard
                playerLabels={playerLabels}
                cumulativeScores={[...gameState.cumulativeScores]}
                handScores={[...gameState.handScores]}
                dangerIndex={dangerIndex}
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={handleNextHand}
                accessibilityRole="button"
                accessibilityLabel={t("hand_end.next")}
              >
                <Text style={[styles.btnText, { color: colors.textOnAccent }]}>
                  {t("hand_end.next")}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Game-over overlay ──────────────────────────────────────── */}
      {gameState.phase === "game_over" && (
        <Modal visible transparent animationType="fade" accessibilityViewIsModal>
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <View
              style={[
                styles.panel,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.panelTitle, { color: colors.text }]}>
                {t("game_over.title")}
              </Text>
              <Text style={[styles.winnerText, { color: colors.accent }]}>
                {t("game_over.winner", { label: playerLabels[gameState.winnerIndex ?? 0] ?? "" })}
              </Text>
              <ScoreBoard
                playerLabels={playerLabels}
                cumulativeScores={[...gameState.cumulativeScores]}
                handScores={[...gameState.handScores]}
                dangerIndex={dangerIndex}
              />

              {submitState !== "done" && (
                <>
                  <TextInput
                    style={[
                      styles.nameInput,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceAlt,
                      },
                    ]}
                    value={playerName}
                    onChangeText={setPlayerName}
                    placeholder={t("game_over.name_placeholder")}
                    placeholderTextColor={colors.textMuted}
                    maxLength={MAX_NAME_LENGTH}
                    accessibilityLabel={t("game_over.name_placeholder")}
                    editable={submitState !== "submitting"}
                  />
                  <Pressable
                    style={[
                      styles.btn,
                      {
                        backgroundColor:
                          playerName.trim() && submitState !== "submitting"
                            ? colors.accent
                            : colors.surfaceAlt,
                      },
                    ]}
                    onPress={() => void handleSubmitScore()}
                    disabled={!playerName.trim() || submitState === "submitting"}
                    accessibilityRole="button"
                    accessibilityLabel={
                      submitState === "submitting"
                        ? t("game_over.submitting")
                        : submitState === "error"
                          ? t("game_over.retry")
                          : t("game_over.submit")
                    }
                    accessibilityState={{
                      disabled: !playerName.trim() || submitState === "submitting",
                    }}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        {
                          color:
                            playerName.trim() && submitState !== "submitting"
                              ? colors.textOnAccent
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {submitState === "submitting"
                        ? t("game_over.submitting")
                        : submitState === "error"
                          ? t("game_over.retry")
                          : t("game_over.submit")}
                    </Text>
                  </Pressable>
                  {submitState === "error" && (
                    <Text style={[styles.errorText, { color: colors.error }]}>
                      {t("game_over.submit_error")}
                    </Text>
                  )}
                </>
              )}
              {submitState === "done" && (
                <Text style={[styles.successText, { color: colors.accent }]}>
                  {t("game_over.submitted")}
                </Text>
              )}

              <Pressable
                style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
                onPress={handlePlayAgain}
                accessibilityRole="button"
                accessibilityLabel={t("game_over.again")}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>{t("game_over.again")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Score panel modal ──────────────────────────────────────── */}
      <Modal
        visible={showScores}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScores(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.panelTitle, { color: colors.text }]}>{t("score.board")}</Text>
            <ScoreBoard
              playerLabels={playerLabels}
              cumulativeScores={[...gameState.cumulativeScores]}
              handScores={[...gameState.handScores]}
              dangerIndex={dangerIndex}
            />
            <Pressable
              style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => setShowScores(false)}
              accessibilityRole="button"
              accessibilityLabel={t("score.close")}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{t("score.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  table: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  topArea: {
    alignItems: "center",
    paddingTop: 4,
  },
  middleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  bottomArea: {
    paddingBottom: 8,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    alignItems: "center",
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  moonText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  winnerText: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  nameInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
  },
  successText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
