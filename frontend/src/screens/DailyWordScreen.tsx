import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { typography } from "../theme/typography";
import { GameShell } from "../components/shared/GameShell";
import {
  applyServerResult,
  buildShareText,
  deleteLastLetter,
  initialState,
  markComplete,
  setCurrentRowLetter,
} from "../game/daily_word/engine";
import { dailyWordApi } from "../game/daily_word/api";
import { clearState, loadState, saveState } from "../game/daily_word/storage";
import type { DailyWordState, LetterStatus, TileState, TileStatus } from "../game/daily_word/types";
import { useGameSync } from "../game/_shared/useGameSync";
import { ApiError } from "../game/_shared/httpClient";
import { DW } from "../game/daily_word/tokens/colors";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLIP_DURATION_MS = 150;
const FLIP_STAGGER_MS = 100;

const TILE_BG: Record<TileStatus, string> = {
  correct: DW.tileCorrect,
  present: DW.tilePresent,
  absent: DW.tileAbsent,
  tbd: DW.tileTbd,
  empty: DW.tileTbd,
};
const TILE_BORDER: Record<TileStatus, string> = {
  correct: DW.tileCorrect,
  present: DW.tilePresent,
  absent: DW.tileAbsent,
  tbd: DW.tileBorderNeutral,
  empty: DW.tileBorderEmpty,
};
const TILE_TEXT: Record<TileStatus, string> = {
  correct: DW.textWhite,
  present: DW.textWhite,
  absent: DW.textWhite,
  tbd: DW.textWhite,
  empty: DW.textWhite,
};
const KEY_BG: Record<LetterStatus, string> = {
  correct: DW.keyCorrect,
  present: DW.keyPresent,
  absent: DW.keyAbsent,
  unused: DW.keyUnused,
};
const KEY_TEXT: Record<LetterStatus, string> = {
  correct: DW.textWhite,
  present: DW.textWhite,
  absent: DW.textWhite,
  unused: DW.textWhite,
};

// ---------------------------------------------------------------------------
// Keyboard layouts
// ---------------------------------------------------------------------------

const EN_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const HI_ROWS = [
  ["अ", "आ", "इ", "ई", "उ", "ऊ", "ए", "ऐ", "ओ", "औ"],
  ["क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ"],
  ["ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न"],
  ["प", "फ", "ब", "भ", "म", "य", "र", "ल", "व", "श"],
  ["ष", "स", "ह"],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msUntilMidnight(tzOffsetMinutes: number): number {
  const nowLocalMs = Date.now() + tzOffsetMinutes * 60_000;
  const midnight = Math.ceil(nowLocalMs / 86_400_000) * 86_400_000;
  return midnight - nowLocalMs;
}

function formatCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function tzOffset(): number {
  return -new Date().getTimezoneOffset();
}

function langFromI18n(language: string): string {
  return language.startsWith("hi") ? "hi" : "en";
}

// ---------------------------------------------------------------------------
// Tile component
// ---------------------------------------------------------------------------

interface TileProps {
  tile: TileState;
  scaleY: SharedValue<number>;
  revealed: boolean;
}

function Tile({ tile, scaleY, revealed }: TileProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scaleY: interpolate(scaleY.value, [0, 1], [0, 1]),
      },
    ],
  }));

  const status = tile.status;
  return (
    <Animated.View
      style={[
        styles.tile,
        { backgroundColor: TILE_BG[status], borderColor: TILE_BORDER[status] },
        revealed && animStyle,
      ]}
    >
      <Text style={[styles.tileLetter, { color: TILE_TEXT[status] }]}>
        {tile.letter.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// DailyWordScreen
// ---------------------------------------------------------------------------

export default function DailyWordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { t, i18n } = useTranslation(["daily_word", "common"]);
  const insets = useSafeAreaInsets();
  const { start, markStarted, complete } = useGameSync("daily_word");

  const [gameState, setGameState] = useState<DailyWordState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("00:00:00");

  // Tile flip shared values — one scaleY per tile slot, pre-allocated up to MAX_WORD_LEN
  const s0 = useSharedValue(1);
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  const s4 = useSharedValue(1);
  const s5 = useSharedValue(1);
  const s6 = useSharedValue(1);
  const s7 = useSharedValue(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tileScales = useMemo(() => [s0, s1, s2, s3, s4, s5, s6, s7], []);

  // Row shake shared value
  const shakeX = useSharedValue(0);

  // Tracks which row is mid-animation and what tiles to reveal at the midpoint
  const animRowRef = useRef<number>(-1);
  const pendingRevealRef = useRef<TileState[] | null>(null);
  const [revealedTiles, setRevealedTiles] = useState<{ rowIdx: number; tiles: TileState[] } | null>(
    null
  );

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Mount: load state, compare puzzle_id
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function init() {
      try {
        const lang = langFromI18n(i18n.language);
        const today = await dailyWordApi.getToday(tzOffset(), lang);
        const saved = await loadState();
        let state: DailyWordState;
        if (saved && saved.puzzle_id === today.puzzle_id) {
          state = saved;
        } else {
          if (saved) await clearState();
          state = initialState(today.puzzle_id, today.word_length, lang);
          await saveState(state);
        }
        setGameState(state);
        start({});
      } catch {
        setError(t("daily_word:error.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the answer whenever the game enters a completed-loss state
  // (covers both on-mount resume and the live submit path).
  useEffect(() => {
    if (gameState?.is_complete && !gameState.won && answer === null) {
      dailyWordApi
        .getAnswer(gameState.puzzle_id)
        .then((r) => setAnswer(r.answer))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.is_complete, gameState?.won]);

  // ---------------------------------------------------------------------------
  // Countdown timer (cleared on unmount)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const tz = tzOffset();
    const tick = () => setCountdown(formatCountdown(msUntilMidnight(tz)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Toast helper
  // ---------------------------------------------------------------------------

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const shakeRow = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  }, [shakeX]);

  const revealTile = useCallback((tileIdx: number, tile: TileState, rowIdx: number) => {
    if (!pendingRevealRef.current) return;
    pendingRevealRef.current[tileIdx] = tile;
    setRevealedTiles({ rowIdx, tiles: [...pendingRevealRef.current] });
  }, []);

  const runFlipAnimation = useCallback(
    (rowIdx: number, serverTiles: TileState[], wordLen: number, onDone: () => void) => {
      pendingRevealRef.current = Array.from({ length: wordLen }, (_, i) => ({
        letter: serverTiles[i]?.letter ?? "",
        status: "tbd" as TileStatus,
      }));
      animRowRef.current = rowIdx;

      for (let i = 0; i < wordLen; i++) {
        const sv = tileScales[i]!;
        const tile = serverTiles[i]!;
        const isLast = i === wordLen - 1;

        sv.value = withDelay(
          i * FLIP_STAGGER_MS,
          withSequence(
            withTiming(0, { duration: FLIP_DURATION_MS }, (finished) => {
              if (finished) runOnJS(revealTile)(i, tile, rowIdx);
            }),
            withTiming(1, { duration: FLIP_DURATION_MS }, (finished) => {
              if (finished && isLast) runOnJS(onDone)();
            })
          )
        );
      }
    },
    [tileScales, revealTile]
  );

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  const handleKey = useCallback(
    (letter: string) => {
      if (!gameState || gameState.is_complete || submitting) return;
      const next = setCurrentRowLetter(gameState, letter);
      if (next === gameState) return;
      markStarted();
      setGameState(next);
      saveState(next).catch(() => {});
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [gameState, submitting, markStarted]
  );

  const handleDelete = useCallback(() => {
    if (!gameState || gameState.is_complete || submitting) return;
    const next = deleteLastLetter(gameState);
    if (next === gameState) return;
    setGameState(next);
    saveState(next).catch(() => {});
  }, [gameState, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!gameState || gameState.is_complete || submitting) return;

    const row = gameState.rows[gameState.current_row];
    if (!row) return;
    const filled = row.tiles.filter((t) => t.letter !== "").length;
    if (filled < gameState.word_length) {
      showToast(t("daily_word:error.tooShort"));
      shakeRow();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    const guess = row.tiles.map((t) => t.letter).join("");
    setSubmitting(true);

    try {
      const tz = tzOffset();
      const result = await dailyWordApi.submitGuess(gameState.puzzle_id, guess, tz);
      const serverTiles: TileState[] = result.tiles.map((t) => ({
        letter: t.letter,
        status: t.status,
      }));

      const rowIdx = gameState.current_row;
      const wordLen = gameState.word_length;

      // Reset all tile scales before animating
      for (let i = 0; i < wordLen; i++) tileScales[i]!.value = 1;

      await new Promise<void>((resolve) => {
        runFlipAnimation(rowIdx, serverTiles, wordLen, resolve);
      });

      // Clear animation state
      animRowRef.current = -1;
      pendingRevealRef.current = null;
      setRevealedTiles(null);

      const afterGuess = applyServerResult(gameState, serverTiles);
      const won = serverTiles.every((t) => t.status === "correct");
      const lost = !won && afterGuess.current_row >= 6;

      let final = afterGuess;
      if (won || lost) {
        final = markComplete(afterGuess, won);
        complete({ finalScore: won ? afterGuess.current_row : 0, outcome: won ? "won" : "lost" });
        if (lost) {
          dailyWordApi
            .getAnswer(gameState.puzzle_id)
            .then((r) => setAnswer(r.answer))
            .catch(() => {});
        }
      }

      setGameState(final);
      await saveState(final);

      if (won) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        showToast(t("daily_word:error.invalidWord"));
        shakeRow();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        showToast(t("daily_word:error.guessFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }, [gameState, submitting, t, showToast, complete, runFlipAnimation, shakeRow, tileScales]);

  // ---------------------------------------------------------------------------
  // Share
  // ---------------------------------------------------------------------------

  const handleShare = useCallback(() => {
    if (!gameState) return;
    const text = buildShareText(gameState, "https://bcarcade.com/daily-word");
    Share.share({ message: text }).catch(() => {});
  }, [gameState]);

  // ---------------------------------------------------------------------------
  // Derived display
  // ---------------------------------------------------------------------------

  function getTileForDisplay(rowIdx: number, tileIdx: number): TileState {
    if (revealedTiles && revealedTiles.rowIdx === rowIdx && tileIdx < revealedTiles.tiles.length) {
      return revealedTiles.tiles[tileIdx]!;
    }
    return gameState!.rows[rowIdx]!.tiles[tileIdx]!;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const wordLen = gameState?.word_length ?? 5;
  const lang = gameState?.language ?? langFromI18n(i18n.language);
  const keyboardRows = lang === "hi" ? HI_ROWS : EN_ROWS;
  const keyboardState = gameState?.keyboard_state ?? {};

  function keyBg(letter: string): string {
    const status = (keyboardState[letter.toLowerCase()] as LetterStatus | undefined) ?? "unused";
    return KEY_BG[status];
  }
  function keyTextColor(letter: string): string {
    const status = (keyboardState[letter.toLowerCase()] as LetterStatus | undefined) ?? "unused";
    return KEY_TEXT[status];
  }

  const submittedCount = gameState?.rows.filter((r) => r.submitted).length ?? 0;
  const winModalVisible = !!(gameState?.is_complete && gameState.won);
  const lossModalVisible = !!(gameState?.is_complete && !gameState.won);

  return (
    <GameShell
      title={t("daily_word:game.title")}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error ?? undefined}
    >
      <View
        style={[styles.container, { backgroundColor: DW.bg, paddingBottom: insets.bottom + 8 }]}
      >
        {/* Toast */}
        {toast && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* Tile grid */}
        <ScrollView contentContainerStyle={styles.gridContainer} scrollEnabled={false}>
          {Array.from({ length: 6 }, (_, rowIdx) => {
            const isCurrentRow = gameState ? rowIdx === gameState.current_row : false;
            const isAnimatingRow = rowIdx === animRowRef.current;

            return (
              <Animated.View key={rowIdx} style={[styles.row, isCurrentRow && shakeStyle]}>
                {Array.from({ length: wordLen }, (_, tileIdx) => {
                  const tile = gameState
                    ? getTileForDisplay(rowIdx, tileIdx)
                    : { letter: "", status: "empty" as TileStatus };
                  const sv = tileScales[tileIdx] ?? s0;
                  return <Tile key={tileIdx} tile={tile} scaleY={sv} revealed={isAnimatingRow} />;
                })}
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Keyboard */}
        <View style={styles.keyboard}>
          {keyboardRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.keyRow}>
              {row.map((letter) => (
                <Pressable
                  key={letter}
                  style={[styles.key, { backgroundColor: keyBg(letter) }]}
                  onPress={() => handleKey(letter)}
                  accessibilityLabel={letter}
                  disabled={submitting || gameState?.is_complete}
                >
                  <Text style={[styles.keyText, { color: keyTextColor(letter) }]}>
                    {lang === "en" ? letter.toUpperCase() : letter}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={styles.keyRow}>
            <Pressable
              style={[styles.keyWide, { backgroundColor: DW.keyUnused }]}
              onPress={handleDelete}
              accessibilityLabel={t("daily_word:keyboard.delete")}
              disabled={submitting || gameState?.is_complete}
            >
              <Text style={styles.keyActionText}>{t("daily_word:keyboard.delete")}</Text>
            </Pressable>
            <Pressable
              style={[styles.keyWide, { backgroundColor: DW.keyUnused }]}
              onPress={() => void handleSubmit()}
              accessibilityLabel={t("daily_word:keyboard.submit")}
              disabled={submitting || gameState?.is_complete}
            >
              <Text style={styles.keyActionText}>{t("daily_word:keyboard.submit")}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Win modal */}
      <Modal visible={winModalVisible} transparent animationType="fade" testID="win-modal">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: DW.bgModal }]} testID="win-modal-card">
            <Text style={[styles.modalTitle, { color: DW.accentWin }]}>
              {t("daily_word:win.title")}
            </Text>
            <Text style={styles.modalBody}>
              {t("daily_word:win.guesses_other", { count: submittedCount })}
            </Text>
            <Pressable style={styles.modalBtn} onPress={handleShare}>
              <Text style={styles.modalBtnText}>{t("daily_word:win.share")}</Text>
            </Pressable>
            <Text style={[styles.modalCountdown, { color: DW.textMuted }]}>
              {t("daily_word:loss.nextWord")} {countdown}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Loss modal */}
      <Modal visible={lossModalVisible} transparent animationType="fade" testID="loss-modal">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: DW.bgModal }]} testID="loss-modal-card">
            <Text style={[styles.modalTitle, { color: DW.accentLoss }]}>
              {t("daily_word:loss.title")}
            </Text>
            {answer && (
              <Text style={styles.modalBody}>
                {t("daily_word:loss.answer", { word: answer.toUpperCase() })}
              </Text>
            )}
            <Text style={[styles.modalCountdown, { color: DW.textMuted }]}>
              {t("daily_word:loss.nextWord")} {countdown}
            </Text>
          </View>
        </View>
      </Modal>
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  toastContainer: {
    position: "absolute",
    top: 12,
    zIndex: 10,
    backgroundColor: DW.textWhite,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: {
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    color: DW.textDark,
  },
  gridContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    gap: 5,
  },
  tile: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLetter: {
    fontFamily: typography.heading,
    fontSize: 26,
    lineHeight: 30,
  },
  keyboard: {
    width: "100%",
    paddingHorizontal: 6,
    gap: 6,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  key: {
    height: 56,
    minWidth: 32,
    flex: 1,
    maxWidth: 43,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: typography.label,
    fontSize: 13,
  },
  keyWide: {
    height: 56,
    flex: 1.5,
    maxWidth: 66,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  keyActionText: {
    fontFamily: typography.label,
    fontSize: 12,
    color: DW.textWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: DW.bgModalOverlay,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: 300,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    fontFamily: typography.heading,
    fontSize: 28,
  },
  modalBody: {
    fontFamily: typography.body,
    fontSize: 16,
    color: DW.textBody,
    textAlign: "center",
  },
  modalBtn: {
    backgroundColor: DW.accentWin,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  modalBtnText: {
    fontFamily: typography.label,
    fontSize: 16,
    color: DW.textWhite,
  },
  modalCountdown: {
    fontFamily: typography.body,
    fontSize: 14,
  },
});
