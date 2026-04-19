/**
 * SolitaireScreen (#596).
 *
 * Wires the pure engine (#593) and card components (#595) into a playable
 * Klondike layout inside GameShell. Owns the selection state machine for
 * tap-to-select + tap-target, the double-tap shortcut to the foundations,
 * the undo and auto-complete affordances, and the pre-game draw-mode
 * modal and post-win modal.
 *
 * Lifecycle (AsyncStorage save/resume, score POST) is intentionally not
 * handled here — that's #597. Route wiring and lobby entry are #599.
 */

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
import NewGameConfirmModal from "../components/shared/NewGameConfirmModal";
import TableauPile from "../game/solitaire/components/TableauPile";
import FoundationPile from "../game/solitaire/components/FoundationPile";
import StockWastePile from "../game/solitaire/components/StockWastePile";
import { CARD_HEIGHT, CARD_WIDTH } from "../game/solitaire/components/CardView";
import {
  applyMove,
  autoComplete,
  canAutoComplete,
  dealGame,
  drawFromStock,
  recycleWaste,
  undo,
} from "../game/solitaire/engine";
import type { DrawMode, Move, SolitaireState, Suit } from "../game/solitaire/types";
import { SUITS } from "../game/solitaire/types";

const TABLEAU_COLS = 7;
const COL_GAP = 6;
/** Full-size width of the 7-column board — target scale baseline. */
const BOARD_WIDTH = TABLEAU_COLS * CARD_WIDTH + (TABLEAU_COLS - 1) * COL_GAP;
/** Upper-bound intrinsic board height for layout reservation. Foundations
 * (CARD_HEIGHT) + tableau worst-case (~12 cards × 24px offset + CARD_HEIGHT)
 * + stock+waste (CARD_HEIGHT) + inter-row margins. Scaled by `scale` so the
 * outer wrapper reserves exactly the visible pixel height. */
const BOARD_HEIGHT = CARD_HEIGHT * 3 + 12 * 24 + 12 * 2;
const DOUBLE_TAP_MS = 300;
const AUTO_STEP_MS = 120;

type Selection =
  | { readonly kind: "waste" }
  | { readonly kind: "tableau"; readonly col: number; readonly index: number }
  | { readonly kind: "foundation"; readonly suit: Suit };

export default function SolitaireScreen() {
  const { t } = useTranslation(["solitaire", "common"]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const [state, setState] = useState<SolitaireState | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [moves, setMoves] = useState(0);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [outerWidth, setOuterWidth] = useState(0);

  // Invalid-move flash — red overlay pulse instead of positional shake so we
  // don't fight React Navigation / safe-area layout math.
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);
  const autoStepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoStepTimeoutRef.current !== null) clearTimeout(autoStepTimeoutRef.current);
    };
  }, []);

  const flashInvalid = useCallback(() => {
    setSelection(null);
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.4, duration: 80, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [flashOpacity]);

  const deal = useCallback((drawMode: DrawMode) => {
    setState(dealGame(drawMode));
    setSelection(null);
    setMoves(0);
  }, []);

  const tryMove = useCallback(
    (move: Move): boolean => {
      if (state === null) return false;
      const next = applyMove(state, move);
      if (next === state) return false;
      setState(next);
      setMoves((m) => m + 1);
      setSelection(null);
      return true;
    },
    [state]
  );

  const handleWastePress = useCallback(() => {
    if (state === null || autoCompleting) return;
    const now = Date.now();
    const last = lastTapRef.current;
    const isDouble = last !== null && last.key === "waste" && now - last.time < DOUBLE_TAP_MS;
    lastTapRef.current = { key: "waste", time: now };

    if (isDouble) {
      if (!tryMove({ type: "waste-to-foundation" })) flashInvalid();
      return;
    }
    if (state.waste.length === 0) return;
    if (selection?.kind === "waste") {
      setSelection(null);
      return;
    }
    setSelection({ kind: "waste" });
  }, [state, selection, autoCompleting, tryMove, flashInvalid]);

  const handleStockPress = useCallback(() => {
    if (state === null || autoCompleting) return;
    lastTapRef.current = null;
    const next = state.stock.length > 0 ? drawFromStock(state) : recycleWaste(state);
    if (next === state) return;
    setState(next);
    setSelection(null);
  }, [state, autoCompleting]);

  const handleFoundationPress = useCallback(
    (suit: Suit) => {
      if (state === null || autoCompleting) return;
      lastTapRef.current = null;

      if (selection !== null) {
        if (selection.kind === "waste") {
          if (tryMove({ type: "waste-to-foundation" })) return;
          flashInvalid();
          return;
        }
        if (selection.kind === "tableau") {
          const col = state.tableau[selection.col];
          if (col !== undefined && selection.index === col.length - 1) {
            if (tryMove({ type: "tableau-to-foundation", fromCol: selection.col })) return;
          }
          flashInvalid();
          return;
        }
        if (selection.kind === "foundation") {
          if (selection.suit === suit) setSelection(null);
          else flashInvalid();
          return;
        }
      }
      if (state.foundations[suit].length > 0) {
        setSelection({ kind: "foundation", suit });
      }
    },
    [state, selection, autoCompleting, tryMove, flashInvalid]
  );

  const handleTableauCardPress = useCallback(
    (col: number, index: number) => {
      if (state === null || autoCompleting) return;
      const pile = state.tableau[col];
      if (pile === undefined) return;
      const card = pile[index];
      if (card === undefined) return;

      const key = `tableau:${col}:${index}`;
      const now = Date.now();
      const last = lastTapRef.current;
      const isDouble = last !== null && last.key === key && now - last.time < DOUBLE_TAP_MS;
      lastTapRef.current = { key, time: now };

      if (isDouble && index === pile.length - 1 && card.faceUp) {
        if (!tryMove({ type: "tableau-to-foundation", fromCol: col })) flashInvalid();
        return;
      }

      if (selection !== null) {
        if (selection.kind === "waste") {
          if (tryMove({ type: "waste-to-tableau", toCol: col })) return;
          flashInvalid();
          return;
        }
        if (selection.kind === "foundation") {
          if (tryMove({ type: "foundation-to-tableau", fromSuit: selection.suit, toCol: col }))
            return;
          flashInvalid();
          return;
        }
        if (selection.kind === "tableau") {
          if (selection.col === col) {
            if (selection.index === index) {
              setSelection(null);
              return;
            }
            if (card.faceUp) setSelection({ kind: "tableau", col, index });
            return;
          }
          if (
            tryMove({
              type: "tableau-to-tableau",
              fromCol: selection.col,
              fromIndex: selection.index,
              toCol: col,
            })
          )
            return;
          flashInvalid();
          return;
        }
      }

      if (card.faceUp) setSelection({ kind: "tableau", col, index });
    },
    [state, selection, autoCompleting, tryMove, flashInvalid]
  );

  const handleEmptyTableauPress = useCallback(
    (col: number) => {
      if (state === null || autoCompleting) return;
      lastTapRef.current = null;
      if (selection === null) return;
      if (selection.kind === "waste") {
        if (!tryMove({ type: "waste-to-tableau", toCol: col })) flashInvalid();
        return;
      }
      if (selection.kind === "foundation") {
        if (!tryMove({ type: "foundation-to-tableau", fromSuit: selection.suit, toCol: col }))
          flashInvalid();
        return;
      }
      if (selection.kind === "tableau") {
        if (
          !tryMove({
            type: "tableau-to-tableau",
            fromCol: selection.col,
            fromIndex: selection.index,
            toCol: col,
          })
        )
          flashInvalid();
      }
    },
    [state, selection, autoCompleting, tryMove, flashInvalid]
  );

  const handleUndo = useCallback(() => {
    if (state === null || autoCompleting) return;
    if (state.undoStack.length === 0) return;
    setState(undo(state));
    setSelection(null);
    setMoves((m) => Math.max(0, m - 1));
  }, [state, autoCompleting]);

  const handleAutoComplete = useCallback(() => {
    if (state === null || autoCompleting) return;
    setAutoCompleting(true);
    setSelection(null);
    let current = state;
    const step = () => {
      const next = autoComplete(current);
      if (next === current) {
        setAutoCompleting(false);
        return;
      }
      current = next;
      setState(next);
      setMoves((m) => m + 1);
      if (next.isComplete) {
        setAutoCompleting(false);
        return;
      }
      autoStepTimeoutRef.current = setTimeout(step, AUTO_STEP_MS);
    };
    step();
  }, [state, autoCompleting]);

  const resetToPreGame = useCallback(() => {
    if (autoStepTimeoutRef.current !== null) {
      clearTimeout(autoStepTimeoutRef.current);
      autoStepTimeoutRef.current = null;
    }
    setAutoCompleting(false);
    setState(null);
    setSelection(null);
    setMoves(0);
  }, []);

  const handleNewGamePress = useCallback(() => {
    if (state !== null && state.score > 0 && !state.isComplete) {
      setShowNewGameConfirm(true);
      return;
    }
    resetToPreGame();
  }, [state, resetToPreGame]);

  const handleConfirmNewGame = useCallback(() => {
    setShowNewGameConfirm(false);
    resetToPreGame();
  }, [resetToPreGame]);

  // #597 will POST the score via useGameSync; the button is wired here so the
  // UI is testable now and the handler body fills in when lifecycle lands.
  const handleSubmitScore = useCallback(() => {
    resetToPreGame();
  }, [resetToPreGame]);

  const undoDisabled = state === null || state.undoStack.length === 0 || autoCompleting;
  const showAutoComplete = state !== null && !state.isComplete && canAutoComplete(state);
  const scale = outerWidth > 0 ? Math.min(1, outerWidth / BOARD_WIDTH) : 1;

  const onOuterLayout = useCallback((e: LayoutChangeEvent) => {
    setOuterWidth(Math.floor(e.nativeEvent.layout.width));
  }, []);

  const tableauSelection = (col: number): number | undefined => {
    if (selection === null || selection.kind !== "tableau") return undefined;
    if (selection.col !== col) return undefined;
    return selection.index;
  };

  return (
    <GameShell
      title={t("solitaire:game.title")}
      requireBack
      onBack={() => navigation.goBack()}
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 12),
        paddingRight: Math.max(insets.right, 12),
      }}
      rightSlot={
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleUndo}
            disabled={undoDisabled}
            style={[
              styles.headerBtn,
              { borderColor: colors.accent, opacity: undoDisabled ? 0.4 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("solitaire:buttons.undo")}
            accessibilityState={{ disabled: undoDisabled }}
          >
            <Text style={[styles.headerBtnText, { color: colors.accent }]}>
              {t("solitaire:buttons.undo")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleNewGamePress}
            style={[styles.headerBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t("common:newGame.button")}
          >
            <Text style={[styles.headerBtnText, { color: colors.accent }]}>
              {t("common:newGame.button")}
            </Text>
          </Pressable>
        </View>
      }
    >
      {state === null ? (
        <PreGameModal onChoose={deal} />
      ) : (
        <View style={styles.body} onLayout={onOuterLayout}>
          <View style={styles.hudRow} accessibilityRole="summary">
            <Text
              style={[styles.hudText, { color: colors.text }]}
              accessibilityLabel={t("solitaire:hud.scoreLabel", { score: state.score })}
            >
              {t("solitaire:hud.scoreLabel", { score: state.score })}
            </Text>
            <Text
              style={[styles.hudText, { color: colors.textMuted }]}
              accessibilityLabel={t("solitaire:hud.movesLabel", { moves })}
            >
              {t("solitaire:hud.movesLabel", { moves })}
            </Text>
          </View>

          <View
            style={[styles.boardWrap, outerWidth > 0 ? { height: BOARD_HEIGHT * scale } : null]}
            accessibilityLabel={t("solitaire:a11y.boardRegion")}
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
              <View style={styles.foundationsRow}>
                {SUITS.map((suit) => (
                  <FoundationPile
                    key={suit}
                    pile={state.foundations[suit]}
                    suit={suit}
                    selected={selection?.kind === "foundation" && selection.suit === suit}
                    onPress={handleFoundationPress}
                  />
                ))}
              </View>

              <View style={styles.tableauRow}>
                {state.tableau.map((pile, col) => (
                  <TableauPile
                    key={col}
                    pile={pile}
                    colIndex={col}
                    selectedIndex={tableauSelection(col)}
                    onCardPress={handleTableauCardPress}
                    onEmptyPress={handleEmptyTableauPress}
                  />
                ))}
              </View>

              <View style={styles.stockWasteRow}>
                <StockWastePile
                  stock={state.stock}
                  waste={state.waste}
                  drawMode={state.drawMode}
                  wasteSelected={selection?.kind === "waste"}
                  onStockPress={handleStockPress}
                  onWastePress={handleWastePress}
                />
              </View>
            </View>
          </View>

          {showAutoComplete && (
            <Pressable
              onPress={handleAutoComplete}
              style={[styles.autoBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t("solitaire:buttons.autoComplete")}
            >
              <Text style={[styles.autoBtnText, { color: colors.textOnAccent }]}>
                {t("solitaire:buttons.autoComplete")}
              </Text>
            </Pressable>
          )}

          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.error, opacity: flashOpacity },
            ]}
            testID="solitaire-invalid-flash"
          />
        </View>
      )}

      {state?.isComplete === true && (
        <WinModal
          score={state.score}
          onSubmit={handleSubmitScore}
          onNewGame={handleConfirmNewGame}
        />
      )}

      <NewGameConfirmModal
        visible={showNewGameConfirm}
        onConfirm={handleConfirmNewGame}
        onCancel={() => setShowNewGameConfirm(false)}
      />
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Pre-game draw-mode modal
// ---------------------------------------------------------------------------

function PreGameModal({ onChoose }: { readonly onChoose: (mode: DrawMode) => void }) {
  const { t } = useTranslation("solitaire");
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
            {t("drawMode.title")}
          </Text>
          <Text style={[styles.modalBody, { color: colors.textMuted }]}>{t("drawMode.body")}</Text>
          <Pressable
            style={[styles.modalPrimary, gradient]}
            onPress={() => onChoose(1)}
            accessibilityRole="button"
            accessibilityLabel={t("drawMode.draw1")}
          >
            <Text style={[styles.modalPrimaryText, { color: colors.textOnAccent }]}>
              {t("drawMode.draw1")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modalSecondary, { borderColor: colors.accent }]}
            onPress={() => onChoose(3)}
            accessibilityRole="button"
            accessibilityLabel={t("drawMode.draw3")}
          >
            <Text style={[styles.modalSecondaryText, { color: colors.accent }]}>
              {t("drawMode.draw3")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Win modal
// ---------------------------------------------------------------------------

function WinModal({
  score,
  onSubmit,
  onNewGame,
}: {
  readonly score: number;
  readonly onSubmit: () => void;
  readonly onNewGame: () => void;
}) {
  const { t } = useTranslation(["solitaire", "common"]);
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
            {t("solitaire:win.title")}
          </Text>
          <Text style={[styles.modalBody, { color: colors.textMuted }]}>
            {t("solitaire:win.scoreLabel", { score })}
          </Text>
          <Pressable
            style={[styles.modalPrimary, gradient]}
            onPress={onSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("solitaire:buttons.submitScore")}
          >
            <Text style={[styles.modalPrimaryText, { color: colors.textOnAccent }]}>
              {t("solitaire:buttons.submitScore")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modalSecondary, { borderColor: colors.accent }]}
            onPress={onNewGame}
            accessibilityRole="button"
            accessibilityLabel={t("common:newGame.button")}
          >
            <Text style={[styles.modalSecondaryText, { color: colors.accent }]}>
              {t("common:newGame.button")}
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
  headerRow: {
    flexDirection: "row",
    gap: 8,
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
  foundationsRow: {
    flexDirection: "row",
    gap: COL_GAP,
    marginBottom: 12,
  },
  tableauRow: {
    flexDirection: "row",
    gap: COL_GAP,
    alignItems: "flex-start",
    minHeight: CARD_HEIGHT * 3,
  },
  stockWasteRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  autoBtn: {
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 12,
  },
  autoBtnText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
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
