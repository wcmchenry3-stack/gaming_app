import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";
import type { Colors } from "../theme/ThemeContext";
import { GameShell } from "../components/shared/GameShell";
import { OpponentCapturedPile, SelfCapturedPile } from "../components/hearts/CapturedPile";
import OpponentHand from "../components/hearts/OpponentHand";
import PassBanner from "../components/hearts/PassBanner";
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
import {
  DEFAULT_NAMES,
  loadPlayerNames,
  savePlayerNames,
  validateName,
} from "../game/hearts/playerNames";
import { heartsApi } from "../game/hearts/api";
import { useHeartsRounds } from "../game/hearts/RoundsContext";
import { useGameSync } from "../game/_shared/useGameSync";
import { useNetwork } from "../game/_shared/NetworkContext";
import { OfflineBanner } from "../components/shared/OfflineBanner";
import type { Card, HeartsState, TrickCard } from "../game/hearts/types";

const HUMAN = 0;
const MAX_NAME_LENGTH = 32;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LastTrick = { readonly trick: readonly TrickCard[]; readonly winnerIndex: number } | null;
type SubmitState = "idle" | "submitting" | "done" | "error";

// Side-seat label for narrow slots (West/East). Just the player name; the
// captured pile beneath provides the only seat-level visual weight.
function SideSeatLabel({ label, colors }: { label: string; colors: Colors }) {
  return <Text style={[sideSeatStyles.label, { color: colors.textMuted }]}>{label}</Text>;
}

const sideSeatStyles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600" },
});

export default function HeartsScreen() {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { isOnline, isInitialized } = useNetwork();

  const [gameState, setGameState] = useState<HeartsState>(() => dealGame());
  const [lastTrick, setLastTrick] = useState<LastTrick>(null);
  const [showScores, setShowScores] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [playerNames, setPlayerNames] = useState<string[]>([...DEFAULT_NAMES]);
  const [draftNames, setDraftNames] = useState<string[]>([...DEFAULT_NAMES]);
  const [scoreHistory, setScoreHistory] = useState<number[][]>([]);

  const unmountedRef = useRef(false);
  const loopActiveRef = useRef(false);
  const gameStateRef = useRef<HeartsState>(gameState);
  const lastRecordedHandRef = useRef<number>(0);
  const trickAnimResolverRef = useRef<(() => void) | null>(null);

  const {
    start: syncStart,
    markStarted: syncMarkStarted,
    complete: syncComplete,
    getGameId: syncGetGameId,
  } = useGameSync("hearts");

  // Keep ref in sync for use in event listeners.
  useEffect(() => {
    gameStateRef.current = gameState;
  });

  useEffect(
    () => () => {
      unmountedRef.current = true;
      const resolve = trickAnimResolverRef.current;
      trickAnimResolverRef.current = null;
      if (resolve) resolve();
    },
    []
  );

  // ─── Load saved game and player names on mount ────────────────────────────
  useEffect(() => {
    loadGame().then((saved) => {
      if (saved && !unmountedRef.current) setGameState(saved);
    });
    loadPlayerNames().then((names) => {
      if (!unmountedRef.current) {
        setPlayerNames(names);
        setDraftNames(names);
      }
    });
  }, []);

  // ─── Track per-round score history ────────────────────────────────────────
  // Push the *applied* per-round delta (post-moon: shooter 0, others 26) by
  // diffing post-hand cumulativeScores against the running sum of prior rows.
  // Storing raw handScores here would invert the moon row vs. the totals row
  // (#743). Deriving from cumulative deltas keeps the scoreboard a pure view
  // of engine-authoritative totals.
  useEffect(() => {
    if (gameState.phase !== "dealing" && gameState.phase !== "game_over") return;
    if (gameState.handNumber <= lastRecordedHandRef.current) return;
    lastRecordedHandRef.current = gameState.handNumber;
    setScoreHistory((prev) => {
      const sums = prev.reduce((acc, row) => acc.map((v, i) => v + (row[i] ?? 0)), [0, 0, 0, 0]);
      const delta = gameState.cumulativeScores.map((c, i) => c - (sums[i] ?? 0));
      return [...prev, delta];
    });
  }, [gameState.phase, gameState.handNumber, gameState.cumulativeScores]);

  // ─── Sync snapshot to shared rounds context (read by ScoreboardScreen) ────
  const { setSnapshot: setRoundsSnapshot } = useHeartsRounds();
  useEffect(() => {
    setRoundsSnapshot({
      cumulativeScores: gameState.cumulativeScores,
      scoreHistory,
      playerLabels: playerNames,
    });
  }, [gameState.cumulativeScores, scoreHistory, playerNames, setRoundsSnapshot]);

  // ─── Abandon on back-navigation ───────────────────────────────────────────
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      if (!syncGetGameId()) return;
      if (gameStateRef.current.isComplete) return;
      syncComplete(
        { outcome: "abandoned", finalScore: 0, durationMs: 0 },
        { outcome: "abandoned" }
      );
    });
    return unsub;
  }, [navigation, syncComplete, syncGetGameId]);

  const playerLabels = playerNames;

  // ─── Start sync on first card play ────────────────────────────────────────
  function ensureSyncStarted() {
    if (syncGetGameId()) return;
    syncStart({ initial_score: 0 });
    syncMarkStarted();
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

        const card = selectCardToPlay(
          s.playerHands[s.currentPlayerIndex] as Card[],
          s.currentTrick as TrickCard[],
          s,
          s.currentPlayerIndex
        );
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
          await new Promise<void>((resolve) => {
            trickAnimResolverRef.current = resolve;
          });
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
    if (!syncGetGameId()) return;
    const humanScore = gameState.cumulativeScores[HUMAN] ?? 0;
    const finalScore = Math.max(0, 100 - humanScore);
    syncComplete({ outcome: "completed", finalScore, durationMs: 0 }, { final_score: finalScore });
  }, [gameState.phase, gameState.cumulativeScores, syncComplete, syncGetGameId]);

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
        return;
      }
    }
    setLastTrick(null);
    setGameState(newState);
  }

  // Called by TrickArea when the trick-take animation completes. Resolves the
  // AI loop's pending await; for human-led tricks (no pending resolver),
  // clears lastTrick directly.
  function handleTrickAnimationComplete() {
    if (unmountedRef.current) return;
    const resolve = trickAnimResolverRef.current;
    if (resolve) {
      trickAnimResolverRef.current = null;
      resolve();
    } else if (lastTrick !== null) {
      setLastTrick(null);
    }
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
    if (isInitialized && !isOnline) return;
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
    setScoreHistory([]);
    lastRecordedHandRef.current = 0;
    loopActiveRef.current = false;
    clearGame().catch(() => {});
    const fresh = dealGame();
    setGameState(fresh);
  }

  function handleOpenRename() {
    setDraftNames([...playerNames]);
    setShowRename(true);
  }

  function handleSaveNames() {
    const validated = playerNames.map((def, i) =>
      validateName(draftNames[i] ?? "", DEFAULT_NAMES[i] ?? def)
    );
    setPlayerNames(validated);
    savePlayerNames(validated).catch(() => {});
    setShowRename(false);
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const humanHand = [...(gameState.playerHands[HUMAN] ?? [])];
  const isPassing = gameState.phase === "passing";
  const humanPassSelections = [...(gameState.passSelections[HUMAN] ?? [])];
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

  return (
    <GameShell
      title={t("game.title")}
      onBack={() => navigation.goBack()}
      onNewGame={handlePlayAgain}
      onOpenScoreboard={() => setShowScores(true)}
    >
      {/* ── Table ──────────────────────────────────────────────────── */}
      <View style={[styles.table, { backgroundColor: colors.background }]}>
        {/* Top AI (seat 2) */}
        <View style={styles.topArea}>
          <OpponentHand
            cardCount={gameState.playerHands[2]?.length ?? 0}
            label={playerLabels[2] ?? ""}
          />
          <OpponentCapturedPile
            cards={gameState.wonCards[2] ?? []}
            seatLabel={playerLabels[2] ?? ""}
          />
        </View>

        {/* Middle: Left AI | TrickArea | Right AI */}
        <View style={styles.middleRow}>
          <View style={styles.sideColumn}>
            <SideSeatLabel label={playerLabels[1] ?? ""} colors={colors} />
            <OpponentCapturedPile
              cards={gameState.wonCards[1] ?? []}
              seatLabel={playerLabels[1] ?? ""}
            />
          </View>
          <TrickArea
            trick={[...displayTrick]}
            playerIndex={HUMAN}
            playerLabels={playerLabels}
            winnerIndex={trickWinnerIndex}
            onAnimationComplete={handleTrickAnimationComplete}
          />
          <View style={styles.sideColumn}>
            <SideSeatLabel label={playerLabels[3] ?? ""} colors={colors} />
            <OpponentCapturedPile
              cards={gameState.wonCards[3] ?? []}
              seatLabel={playerLabels[3] ?? ""}
            />
          </View>
        </View>

        {/* Human hand */}
        <View style={styles.bottomArea}>
          <Text style={[styles.humanLabel, { color: colors.textMuted }]}>
            {playerLabels[0] ?? ""}
          </Text>
          {isPassing && (
            <PassBanner
              passDirection={gameState.passDirection}
              selectedCount={humanPassSelections.length}
              onConfirm={handlePassConfirm}
            />
          )}
          <SelfCapturedPile cards={gameState.wonCards[HUMAN] ?? []} />
          <PlayerHand
            hand={humanHand}
            selectedCards={isPassing ? humanPassSelections : undefined}
            validCards={isPassing ? undefined : validCards}
            onCardPress={isPassing ? handlePassCardPress : handleCardPress}
          />
        </View>
      </View>

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
                scoreHistory={scoreHistory}
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
                scoreHistory={scoreHistory}
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
                  {isInitialized && !isOnline ? (
                    <OfflineBanner />
                  ) : (
                    submitState === "error" && (
                      <Text style={[styles.errorText, { color: colors.error }]}>
                        {t("game_over.submit_error")}
                      </Text>
                    )
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
              scoreHistory={scoreHistory}
              dangerIndex={dangerIndex}
            />
            <Pressable
              style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
              onPress={handleOpenRename}
              accessibilityRole="button"
              accessibilityLabel={t("settings.rename")}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{t("settings.rename")}</Text>
            </Pressable>
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

      {/* ── Rename players modal ───────────────────────────────────── */}
      <Modal
        visible={showRename}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRename(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.panelTitle, { color: colors.text }]}>
              {t("settings.rename_title")}
            </Text>
            <ScrollView style={styles.renameScroll} contentContainerStyle={styles.renameContent}>
              {DEFAULT_NAMES.map((def, i) => (
                <View key={i} style={styles.renameRow}>
                  <Text style={[styles.renameLabel, { color: colors.textMuted }]}>
                    {t("settings.player_label", { n: i + 1, default: def })}
                  </Text>
                  <TextInput
                    style={[
                      styles.renameInput,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceAlt,
                      },
                    ]}
                    value={draftNames[i] ?? ""}
                    onChangeText={(v) =>
                      setDraftNames((prev) => {
                        const next = [...prev];
                        next[i] = v;
                        return next;
                      })
                    }
                    placeholder={def}
                    placeholderTextColor={colors.textMuted}
                    maxLength={32}
                    accessibilityLabel={t("settings.player_label", { n: i + 1, default: def })}
                  />
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.accent }]}
              onPress={handleSaveNames}
              accessibilityRole="button"
              accessibilityLabel={t("settings.save")}
            >
              <Text style={[styles.btnText, { color: colors.textOnAccent }]}>
                {t("settings.save")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => setShowRename(false)}
              accessibilityRole="button"
              accessibilityLabel={t("settings.cancel")}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{t("settings.cancel")}</Text>
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
  sideColumn: {
    alignItems: "center",
    gap: 6,
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
  humanLabel: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  renameScroll: {
    width: "100%",
    maxHeight: 260,
  },
  renameContent: {
    gap: 12,
  },
  renameRow: {
    gap: 4,
  },
  renameLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
});
