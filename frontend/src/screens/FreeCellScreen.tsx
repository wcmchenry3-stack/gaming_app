import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import FreeCellBoard from "../components/freecell/FreeCellBoard";
import { CARD_WIDTH, CARD_HEIGHT } from "../components/freecell/FreeCellSlot";
import { FreeCellFoundationAnimation } from "../components/freecell/FreeCellFoundationAnimation";
import { FreeCellGameWinAnimation } from "../components/freecell/FreeCellGameWinAnimation";
import { dealGame, applyMove, undoMove, applyHint, getHintMoves } from "../game/freecell/engine";
import type { FreeCellState, Move } from "../game/freecell/types";
import { clearGame, loadGame, saveGame } from "../game/freecell/storage";
import { useGameEvents } from "../game/_shared/useGameEvents";
import { useSound } from "../game/_shared/useSound";

// 8 columns × 40px + 7 gaps × 4px
const TABLEAU_COLS = 8;
const COL_GAP = 4;
const BOARD_WIDTH = TABLEAU_COLS * CARD_WIDTH + (TABLEAU_COLS - 1) * COL_GAP;
// Top row (free cells + foundations) + gap + tableau worst case (12 cards stacked at 24px offset)
const BOARD_HEIGHT = CARD_HEIGHT * 2 + 8 + 12 * 24 + CARD_HEIGHT;

export default function FreeCellScreen() {
  const { t } = useTranslation("freecell");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const [state, setState] = useState<FreeCellState | null>(null);
  const [loading, setLoading] = useState(true);
  const [outerWidth, setOuterWidth] = useState(0);

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const hasLoadedRef = useRef(false);

  const [showFoundation, setShowFoundation] = useState(false);
  const [showGameWin, setShowGameWin] = useState(false);
  const [showNoMovesBanner, setShowNoMovesBanner] = useState(false);

  const { play: playCardPlace } = useSound("freecell.cardPlace");
  const { play: playSupermove } = useSound("freecell.supermove");
  const { play: playFoundationComplete } = useSound("freecell.foundationComplete");
  const { play: playGameWin } = useSound("freecell.gameWin");
  const { play: playInvalidMove } = useSound("freecell.invalidMove");

  // Mount: resume saved game or deal fresh
  useEffect(() => {
    let alive = true;
    loadGame().then((saved) => {
      if (!alive) return;
      hasLoadedRef.current = true;
      setState(saved ?? dealGame());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist on every state change once the mount load has resolved
  useEffect(() => {
    if (!hasLoadedRef.current || state === null) return;
    saveGame(state).catch(() => {});
  }, [state]);

  useGameEvents(
    state?.events,
    {
      cardPlace: () => {
        playCardPlace();
        setShowNoMovesBanner(false);
      },
      supermove: () => {
        playSupermove();
        setShowNoMovesBanner(false);
      },
      foundationComplete: () => {
        playFoundationComplete();
        setShowFoundation(true);
        setShowNoMovesBanner(false);
      },
      gameWin: () => {
        playGameWin();
        setShowGameWin(true);
        setShowNoMovesBanner(false);
      },
      noMovesAvailable: () => setShowNoMovesBanner(true),
    },
    () => setState((prev) => (prev === null ? null : { ...prev, events: [] }))
  );

  const flashInvalid = useCallback(() => {
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.4, duration: 80, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [flashOpacity]);

  const handleMove = useCallback(
    (move: Move) => {
      if (state === null) return;
      const next = applyMove(state, move);
      if (next === state) {
        flashInvalid();
        playInvalidMove();
        return;
      }
      setState(next);
    },
    [state, flashInvalid, playInvalidMove]
  );

  const handleUndo = useCallback(() => {
    if (state === null || state.undoStack.length === 0) return;
    setShowNoMovesBanner(false);
    setState(undoMove(state));
  }, [state]);

  const handleHint = useCallback(() => {
    if (state === null || state.isComplete) return;
    if (getHintMoves(state).length === 0) {
      setShowNoMovesBanner(true);
      return;
    }
    setState(applyHint(state));
  }, [state]);

  const handleNewGame = useCallback(() => {
    clearGame().catch(() => {});
    setState(dealGame());
  }, []);

  const onOuterLayout = useCallback((e: LayoutChangeEvent) => {
    setOuterWidth(Math.floor(e.nativeEvent.layout.width));
  }, []);

  const undoDisabled = state === null || state.undoStack.length === 0 || state.isComplete;
  const hintDisabled = state === null || state.isComplete;
  const scale = outerWidth > 0 ? Math.min(1, outerWidth / BOARD_WIDTH) : 1;

  return (
    <GameShell
      title={t("freecell:game.title")}
      requireBack
      loading={loading}
      onBack={() => navigation.popToTop()}
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 12),
        paddingRight: Math.max(insets.right, 12),
      }}
      onNewGame={handleNewGame}
      rightSlot={
        <View style={styles.headerBtnRow}>
          <Pressable
            onPress={handleHint}
            disabled={hintDisabled}
            style={[
              styles.headerBtn,
              { borderColor: colors.bonus, opacity: hintDisabled ? 0.4 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("freecell:action.hint")}
            accessibilityState={{ disabled: hintDisabled }}
          >
            <Text style={[styles.headerBtnText, { color: colors.bonus }]}>
              {t("freecell:action.hint")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleUndo}
            disabled={undoDisabled}
            style={[
              styles.headerBtn,
              { borderColor: colors.accent, opacity: undoDisabled ? 0.4 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("freecell:action.undo")}
            accessibilityState={{ disabled: undoDisabled }}
          >
            <Text style={[styles.headerBtnText, { color: colors.accent }]}>
              {t("freecell:action.undo")}
            </Text>
          </Pressable>
        </View>
      }
    >
      {state !== null && (
        <View style={styles.body} onLayout={onOuterLayout}>
          <View style={styles.hudRow} accessibilityRole="summary">
            <Text
              style={[styles.hudText, { color: colors.textMuted }]}
              accessibilityLabel={t("freecell:score.moves", { moves: state.moveCount })}
            >
              {t("freecell:score.moves", { moves: state.moveCount })}
            </Text>
          </View>

          <View
            style={[styles.boardWrap, outerWidth > 0 ? { height: BOARD_HEIGHT * scale } : null]}
            accessibilityLabel={t("freecell:a11y.boardRegion")}
          >
            <View
              style={[
                styles.board,
                {
                  width: BOARD_WIDTH,
                  transform: [{ scale }],
                } as ViewStyle,
              ]}
            >
              <FreeCellBoard state={state} onMove={handleMove} />
            </View>
          </View>

          {showNoMovesBanner && (
            <View
              style={[
                styles.noMovesBanner,
                { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
              ]}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Text style={[styles.noMovesText, { color: colors.text }]}>
                {t("freecell:noMoves.message")}
              </Text>
              <Pressable
                onPress={handleUndo}
                disabled={undoDisabled}
                style={[
                  styles.noMovesUndoBtn,
                  { borderColor: colors.accent, opacity: undoDisabled ? 0.4 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("freecell:action.undo")}
              >
                <Text style={[styles.headerBtnText, { color: colors.accent }]}>
                  {t("freecell:action.undo")}
                </Text>
              </Pressable>
            </View>
          )}

          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.error, opacity: flashOpacity },
            ]}
            testID="freecell-invalid-flash"
          />
        </View>
      )}

      {state?.isComplete === true && (
        <WinModal
          moves={state.moveCount}
          onNewGame={handleNewGame}
          onGoHome={() => navigation.popToTop()}
        />
      )}

      <FreeCellFoundationAnimation
        visible={showFoundation}
        onAnimationEnd={() => setShowFoundation(false)}
      />
      <FreeCellGameWinAnimation visible={showGameWin} onDismiss={() => setShowGameWin(false)} />
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Win modal
// ---------------------------------------------------------------------------

function WinModal({
  moves,
  onNewGame,
  onGoHome,
}: {
  readonly moves: number;
  readonly onNewGame: () => void;
  readonly onGoHome: () => void;
}) {
  const { t } = useTranslation("freecell");
  const { colors } = useTheme();

  const gradient: ViewStyle =
    Platform.OS === "web"
      ? ({
          backgroundImage: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`,
        } as ViewStyle)
      : { backgroundColor: colors.accentBright };

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
            {t("win.title")}
          </Text>
          <Text style={[styles.modalBody, { color: colors.textMuted }]}>
            {t("win.moves", { moves })}
          </Text>

          <Pressable
            style={[styles.modalPrimary, gradient]}
            onPress={onNewGame}
            accessibilityRole="button"
            accessibilityLabel={t("win.newGame")}
          >
            <Text style={[styles.modalPrimaryText, { color: colors.textOnAccent }]}>
              {t("win.newGame")}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.modalSecondary, { borderColor: colors.accent }]}
            onPress={onGoHome}
            accessibilityRole="button"
            accessibilityLabel={t("win.goHome")}
          >
            <Text style={[styles.modalSecondaryText, { color: colors.accent }]}>
              {t("win.goHome")}
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
  body: {
    flex: 1,
  },
  headerBtnRow: {
    flexDirection: "row",
    gap: 6,
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
  noMovesBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  noMovesText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  noMovesUndoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  hudText: {
    fontFamily: typography.heading,
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  modalPrimary: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 10,
    alignItems: "center",
    minWidth: 180,
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
