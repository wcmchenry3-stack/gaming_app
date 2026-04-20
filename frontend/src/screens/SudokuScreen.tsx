/**
 * SudokuScreen (#618) — playable Sudoku inside `GameShell`.
 *
 * Scope is deliberately limited to layout, input, and the win flow.
 * AsyncStorage save/resume, the `POST /sudoku/score` call, and
 * `useGameSync` instrumentation live in #619 and hook in through the
 * `handleSubmitScore` stub below.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import type { AppStateStatus } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { HomeStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { typography } from "../theme/typography";
import { GameShell } from "../components/shared/GameShell";
import SudokuGrid from "../components/sudoku/SudokuGrid";
import NumberPad from "../components/sudoku/NumberPad";
import DifficultySelector from "../components/sudoku/DifficultySelector";
import {
  enterDigit,
  eraseCell,
  getConflicts,
  loadPuzzle,
  selectCell,
  toggleNotesMode,
  undo,
} from "../game/sudoku/engine";
import type { CellValue, Difficulty, SudokuState } from "../game/sudoku/types";

const FLASH_MS = 200;
const DIFFICULTY_BASE: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 300,
};

function computeScore(difficulty: Difficulty, errors: number): number {
  return Math.max(0, DIFFICULTY_BASE[difficulty] - errors * 10);
}

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function SudokuScreen() {
  const { t } = useTranslation("sudoku");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [state, setState] = useState<SudokuState | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Timer bookkeeping. `startMs` is the wall-clock at which the current
  // play session "began", adjusted forward by any time spent in the
  // background so `elapsed` reads as "time actively spent playing."
  // null = timer hasn't started yet (no digit placed).
  const startMsRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invalid-move flash (mirrors the Solitaire pattern — a brief
  // full-board red tint beats per-cell animations for code complexity).
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const isComplete = state?.isComplete ?? false;

  const tickTimer = useCallback(() => {
    if (startMsRef.current === null) return;
    setElapsed(Math.floor((Date.now() - startMsRef.current) / 1000));
  }, []);

  // Start/stop the once-per-second ticker. The timer only runs while a
  // game is in progress, not complete, and actually started.
  useEffect(() => {
    if (!state || isComplete || startMsRef.current === null) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(tickTimer, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state, isComplete, tickTimer]);

  // Pause on background, resume on foreground — shift `startMsRef`
  // forward by the time spent away so elapsed resumes where it left off.
  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      if (startMsRef.current === null) return;
      if (isComplete) return;
      if (next !== "active") {
        pausedAtRef.current = Date.now();
      } else if (pausedAtRef.current !== null && startMsRef.current !== null) {
        startMsRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
    };
    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, [isComplete]);

  const flashError = useCallback(() => {
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 0.3,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: FLASH_MS - 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [flashOpacity]);

  const handleStart = useCallback(() => {
    const fresh = loadPuzzle(difficulty);
    setState(fresh);
    setElapsed(0);
    startMsRef.current = null;
    pausedAtRef.current = null;
  }, [difficulty]);

  const handleCellPress = useCallback((row: number, col: number) => {
    setState((s) => (s ? selectCell(s, row, col) : s));
  }, []);

  const handleDigit = useCallback(
    (digit: CellValue) => {
      setState((s) => {
        if (!s) return s;
        const next = enterDigit(s, digit);
        if (next === s) return s;

        // Start the timer on the first input that actually changes state.
        if (startMsRef.current === null) startMsRef.current = Date.now();

        // Conflict flash — only in normal mode.  `isError` is set on the
        // newly-placed cell when the digit disagrees with the solution,
        // which is equivalent to "this value conflicts with a peer the
        // puzzle intends to occupy."
        if (!s.notesMode && s.selectedRow !== null && s.selectedCol !== null) {
          const cell = next.grid[s.selectedRow]?.[s.selectedCol];
          if (cell?.isError) {
            const conflicts = getConflicts(next.grid, s.selectedRow, s.selectedCol, digit);
            if (conflicts.length > 0) flashError();
          }
        }
        return next;
      });
    },
    [flashError]
  );

  const handleErase = useCallback(() => {
    setState((s) => (s ? eraseCell(s) : s));
  }, []);

  const handleToggleNotes = useCallback(() => {
    setState((s) => (s ? toggleNotesMode(s) : s));
  }, []);

  const handleUndo = useCallback(() => {
    setState((s) => (s ? undo(s) : s));
  }, []);

  const handleChangeDifficulty = useCallback(() => {
    setState(null);
    setElapsed(0);
    startMsRef.current = null;
    pausedAtRef.current = null;
  }, []);

  // Stubbed for #619 — actual POST /sudoku/score is wired there.  The
  // button is visible now so the layout and a11y tree are final.
  const handleSubmitScore = useCallback(() => {
    // No-op in #618.  #619 will replace this with the leaderboard POST.
  }, []);

  const headerRight = useMemo(() => {
    if (!state) return null;
    const undoDisabled = state.undoStack.length === 0;
    return (
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleUndo}
          disabled={undoDisabled}
          style={[
            styles.headerBtn,
            { borderColor: colors.accent, opacity: undoDisabled ? 0.4 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("action.undo")}
          accessibilityState={{ disabled: undoDisabled }}
        >
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>{t("action.undo")}</Text>
        </Pressable>
        <Pressable
          onPress={handleToggleNotes}
          style={[
            styles.headerBtn,
            {
              borderColor: colors.accent,
              backgroundColor: state.notesMode ? colors.accent : "transparent",
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("numberPad.toggleNotes")}
          accessibilityState={{ selected: state.notesMode }}
        >
          <Text
            style={[
              styles.headerBtnText,
              {
                color: state.notesMode ? colors.textOnAccent : colors.accent,
              },
            ]}
          >
            {t("numberPad.notes")}
          </Text>
        </Pressable>
      </View>
    );
  }, [state, colors, handleUndo, handleToggleNotes, t]);

  return (
    <GameShell
      title={t("game.title")}
      requireBack
      onBack={() => navigation.popToTop()}
      rightSlot={headerRight}
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(insets.left, 12),
        paddingRight: Math.max(insets.right, 12),
      }}
    >
      {state === null ? (
        <PreGame difficulty={difficulty} onChange={setDifficulty} onStart={handleStart} />
      ) : (
        <View style={styles.body}>
          <View style={styles.hudRow} accessibilityRole="summary">
            <Text style={[styles.hudText, { color: colors.text }]}>
              {t(`difficulty.${state.difficulty}`)}
            </Text>
            <Text style={[styles.hudText, { color: colors.textMuted }]}>
              {state.errorCount === 1
                ? t("hud.errorsOne")
                : t("hud.errors", { count: state.errorCount })}
            </Text>
            <Text
              style={[styles.hudText, { color: colors.textMuted }]}
              accessibilityLabel={t("hud.elapsed", {
                time: formatElapsed(elapsed),
              })}
            >
              {formatElapsed(elapsed)}
            </Text>
          </View>

          <View style={styles.gridWrap}>
            <SudokuGrid
              grid={state.grid}
              selectedRow={state.selectedRow}
              selectedCol={state.selectedCol}
              onCellPress={handleCellPress}
            />
          </View>

          <View style={styles.padWrap}>
            <NumberPad
              grid={state.grid}
              notesMode={state.notesMode}
              onDigit={handleDigit}
              onErase={handleErase}
              onToggleNotes={handleToggleNotes}
            />
          </View>

          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.error, opacity: flashOpacity },
            ]}
            testID="sudoku-invalid-flash"
          />
        </View>
      )}

      {state !== null && isComplete ? (
        <WinModal
          difficulty={state.difficulty}
          errors={state.errorCount}
          elapsed={elapsed}
          score={computeScore(state.difficulty, state.errorCount)}
          onSubmitScore={handleSubmitScore}
          onNewPuzzle={handleStart}
          onChangeDifficulty={handleChangeDifficulty}
        />
      ) : null}
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Pre-game — difficulty picker + start button
// ---------------------------------------------------------------------------

function PreGame({
  difficulty,
  onChange,
  onStart,
}: {
  readonly difficulty: Difficulty;
  readonly onChange: (d: Difficulty) => void;
  readonly onStart: () => void;
}) {
  const { t } = useTranslation("sudoku");
  const { colors } = useTheme();
  const gradient: ViewStyle =
    Platform.OS === "web"
      ? ({
          backgroundImage: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`,
        } as ViewStyle)
      : { backgroundColor: colors.accentBright };

  return (
    <View style={styles.preGameWrap}>
      <View
        style={[
          styles.preGameCard,
          { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.preGameTitle, { color: colors.text }]} accessibilityRole="header">
          {t("preGame.title")}
        </Text>
        <Text style={[styles.preGameBody, { color: colors.textMuted }]}>{t("preGame.body")}</Text>
        <View style={styles.preGameSelector}>
          <DifficultySelector value={difficulty} onChange={onChange} />
        </View>
        <Pressable
          onPress={onStart}
          style={[styles.preGameStart, gradient]}
          accessibilityRole="button"
          accessibilityLabel={t("action.start")}
        >
          <Text style={[styles.preGameStartText, { color: colors.textOnAccent }]}>
            {t("action.start")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Win modal
// ---------------------------------------------------------------------------

function WinModal({
  difficulty,
  errors,
  elapsed,
  score,
  onSubmitScore,
  onNewPuzzle,
  onChangeDifficulty,
}: {
  readonly difficulty: Difficulty;
  readonly errors: number;
  readonly elapsed: number;
  readonly score: number;
  readonly onSubmitScore: () => void;
  readonly onNewPuzzle: () => void;
  readonly onChangeDifficulty: () => void;
}) {
  const { t } = useTranslation("sudoku");
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
            {t(`difficulty.${difficulty}`)}
          </Text>
          <Text style={[styles.modalBody, { color: colors.text }]}>
            {t("win.score", { score })}
          </Text>
          <Text style={[styles.modalBody, { color: colors.textMuted }]}>
            {t("win.errors", { count: errors })}
          </Text>
          <Text style={[styles.modalBody, { color: colors.textMuted }]}>
            {t("win.elapsed", { time: formatElapsed(elapsed) })}
          </Text>

          <Pressable
            style={[styles.modalPrimary, gradient]}
            onPress={onSubmitScore}
            accessibilityRole="button"
            accessibilityLabel={t("action.submitScore")}
          >
            <Text style={[styles.modalPrimaryText, { color: colors.textOnAccent }]}>
              {t("action.submitScore")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modalSecondary, { borderColor: colors.accent }]}
            onPress={onNewPuzzle}
            accessibilityRole="button"
            accessibilityLabel={t("action.newGame")}
          >
            <Text style={[styles.modalSecondaryText, { color: colors.accent }]}>
              {t("action.newGame")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modalSecondary, { borderColor: colors.accent }]}
            onPress={onChangeDifficulty}
            accessibilityRole="button"
            accessibilityLabel={t("action.changeDifficulty")}
          >
            <Text style={[styles.modalSecondaryText, { color: colors.accent }]}>
              {t("action.changeDifficulty")}
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
    gap: 12,
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
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  hudText: {
    fontFamily: typography.heading,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  gridWrap: {
    alignSelf: "stretch",
  },
  padWrap: {
    alignSelf: "stretch",
    marginTop: "auto",
  },
  preGameWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  preGameCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    width: "90%",
    maxWidth: 360,
    alignItems: "center",
  },
  preGameTitle: {
    fontFamily: typography.heading,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  preGameBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  preGameSelector: {
    alignSelf: "stretch",
    marginBottom: 20,
  },
  preGameStart: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 180,
    alignItems: "center",
  },
  preGameStartText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
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
    marginBottom: 6,
    textAlign: "center",
  },
  modalPrimary: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 14,
    marginBottom: 8,
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
    marginTop: 8,
    minWidth: 180,
    alignItems: "center",
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
