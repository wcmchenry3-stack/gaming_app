import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
import type { Card, HeartsState, TrickCard } from "../game/hearts/types";

const HUMAN = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LastTrick = { readonly trick: readonly TrickCard[]; readonly winnerIndex: number } | null;

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

  const unmountedRef = useRef(false);
  const loopActiveRef = useRef(false);

  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    []
  );

  const playerLabels = [t("player.you"), t("player.left"), t("player.top"), t("player.right")];

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

  // Trigger AI loop when it's their turn; wait for lastTrick display to clear first.
  useEffect(() => {
    if (gameState.phase !== "playing") return;
    if (gameState.currentPlayerIndex === HUMAN) return;
    if (lastTrick !== null) return;
    void runAiTurns(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.tricksPlayedInHand, lastTrick]);

  // ─── Human card play ──────────────────────────────────────────────────────
  function handleCardPress(card: Card) {
    if (gameState.currentPlayerIndex !== HUMAN || gameState.phase !== "playing") return;
    const willComplete = gameState.currentTrick.length === 3;
    const completedTrick: readonly TrickCard[] | null = willComplete
      ? [...gameState.currentTrick, { card, playerIndex: HUMAN }]
      : null;

    const newState = playCard(gameState, HUMAN, card);

    if (completedTrick && newState.phase === "playing") {
      setLastTrick({ trick: completedTrick, winnerIndex: newState.currentLeaderIndex });
      setGameState(newState);
      setTimeout(() => {
        if (!unmountedRef.current) setLastTrick(null);
      }, 1500);
    } else {
      setLastTrick(null);
      setGameState(newState);
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
    setGameState(dealNextHand(gameState));
  }

  // ─── Game over ────────────────────────────────────────────────────────────
  function handlePlayAgain() {
    setLastTrick(null);
    loopActiveRef.current = false;
    setGameState(dealGame());
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
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={handlePlayAgain}
                accessibilityRole="button"
                accessibilityLabel={t("game_over.again")}
              >
                <Text style={[styles.btnText, { color: colors.textOnAccent }]}>
                  {t("game_over.again")}
                </Text>
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
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
