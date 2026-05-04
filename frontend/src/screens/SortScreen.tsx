import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { HomeStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { typography } from "../theme/typography";
import { applyPour, initState, isValidPour, undo as undoState } from "../game/sort/engine";
import { getNextHint } from "../game/sort/solver";
import type { SortState } from "../game/sort/types";
import type { Color } from "../game/sort/types";
import SortBoard from "../game/sort/components/SortBoard";
import LevelSelectScreen from "../game/sort/components/LevelSelectScreen";
import { sortApi, type LevelData, type ScoreEntry } from "../game/sort/api";
import {
  clearGame,
  loadProgress,
  saveProgress,
  type SortProgress,
} from "../game/sort/storage";

const MAX_NAME_LENGTH = 32;

type View = "loading" | "select" | "play";
type SelectTab = "levels" | "leaderboard";

export default function SortScreen() {
  const { t } = useTranslation("sort");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  // Top-level view
  const [view, setView] = useState<View>("loading");
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [progress, setProgress] = useState<SortProgress>({
    unlockedLevel: 1,
    currentLevelId: null,
    currentState: null,
  });

  // Level select tabs
  const [selectTab, setSelectTab] = useState<SelectTab>("levels");
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Active game
  const [currentLevelId, setCurrentLevelId] = useState<number | null>(null);
  const [gameState, setGameState] = useState<SortState | null>(null);
  const [history, setHistory] = useState<readonly SortState[]>([]);
  const [colorblindMode, setColorblindMode] = useState(false);

  // Win modal
  const [showWinModal, setShowWinModal] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [winEntry, setWinEntry] = useState<ScoreEntry | null>(null);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Mount: load levels and saved progress
  useEffect(() => {
    async function init() {
      const [levelsResult, prog] = await Promise.all([
        sortApi.getLevels().catch(() => null),
        loadProgress(),
      ]);
      if (!levelsResult) {
        setLoadError(true);
      } else {
        setLevels(levelsResult.levels as LevelData[]);
      }
      setProgress(prog);
      setView("select");
    }
    void init();
  }, []);

  // Save progress whenever in-play state changes
  useEffect(() => {
    if (view !== "play" || currentLevelId === null || gameState === null) return;
    const inProgress = !gameState.isComplete;
    const toSave: SortProgress = {
      ...progressRef.current,
      currentLevelId: inProgress ? currentLevelId : null,
      currentState: inProgress ? gameState : null,
    };
    void saveProgress(toSave);
  }, [gameState, view, currentLevelId]);

  // Save progress and clear in-progress on app background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        if (view === "play" && currentLevelId !== null && gameState !== null && !gameState.isComplete) {
          void saveProgress({
            ...progressRef.current,
            currentLevelId,
            currentState: gameState,
          });
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentLevelId, gameState]);

  // Win detection
  useEffect(() => {
    if (gameState?.isComplete && !showWinModal) {
      setShowWinModal(true);
    }
  }, [gameState?.isComplete, showWinModal]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleBottleTap(index: number) {
    if (!gameState || gameState.isComplete) return;
    const { selectedBottleIndex } = gameState;

    if (selectedBottleIndex === null) {
      if (gameState.bottles[index].length > 0) {
        setGameState({ ...gameState, selectedBottleIndex: index });
      }
      return;
    }

    if (index === selectedBottleIndex) {
      setGameState({ ...gameState, selectedBottleIndex: null });
      return;
    }

    if (isValidPour(gameState.bottles[selectedBottleIndex], gameState.bottles[index])) {
      setHistory((h) => [...h, gameState]);
      setGameState(applyPour(gameState, selectedBottleIndex, index));
    } else {
      setGameState({ ...gameState, selectedBottleIndex: null });
    }
  }

  function handleUndo() {
    if (!gameState) return;
    const { state: newState, history: newHistory } = undoState(gameState, history);
    setGameState(newState);
    setHistory(newHistory);
  }

  function handleHint() {
    if (!gameState || gameState.isComplete) return;
    const hint = getNextHint(gameState);
    if (!hint) return;
    setGameState({ ...gameState, selectedBottleIndex: hint.from });
  }

  function handleSelectLevel(levelId: number) {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return;
    setCurrentLevelId(levelId);
    setGameState(initState(level.bottles as (Color | "")[][]));
    setHistory([]);
    setShowWinModal(false);
    setWinEntry(null);
    setSubmitError(false);
    setPlayerName("");
    setView("play");
  }

  function handleContinue() {
    const prog = progressRef.current;
    if (!prog.currentLevelId || !prog.currentState) return;
    setCurrentLevelId(prog.currentLevelId);
    setGameState(prog.currentState);
    setHistory([]);
    setShowWinModal(false);
    setWinEntry(null);
    setSubmitError(false);
    setPlayerName("");
    setView("play");
  }

  function handleBackToSelect() {
    setView("select");
    setShowWinModal(false);
  }

  const handleLoadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await sortApi.getLeaderboard();
      setLeaderboard(res.scores as ScoreEntry[]);
    } catch {
      // ignore, keep stale data
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  function handleSelectTab(tab: SelectTab) {
    setSelectTab(tab);
    if (tab === "leaderboard") {
      void handleLoadLeaderboard();
    }
  }

  async function handleSubmitScore() {
    if (!playerName.trim() || currentLevelId === null || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const entry = await sortApi.submitScore(playerName.trim(), currentLevelId);
      setWinEntry(entry);
      const newUnlockedLevel = Math.min(
        Math.max(progressRef.current.unlockedLevel, currentLevelId + 1),
        levels.length || currentLevelId + 1
      );
      const newProgress: SortProgress = {
        unlockedLevel: newUnlockedLevel,
        currentLevelId: null,
        currentState: null,
      };
      setProgress(newProgress);
      void saveProgress(newProgress);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleNextLevel() {
    const nextId = (currentLevelId ?? 0) + 1;
    const nextLevel = levels.find((l) => l.id === nextId);
    if (!nextLevel) {
      handleBackToSelect();
      return;
    }
    setShowWinModal(false);
    handleSelectLevel(nextId);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderWinModal() {
    if (!gameState || !showWinModal) return null;
    const submitted = winEntry !== null;

    return (
      <Modal
        visible={showWinModal}
        transparent
        animationType="fade"
        onRequestClose={handleBackToSelect}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceHigh }]}>
            <Text style={[styles.winTitle, { color: colors.text }]}>
              {t("win.title")}
            </Text>
            <Text style={[styles.winStat, { color: colors.textMuted }]}>
              {t("win.movesUsed", { moves: gameState.moveCount })}
            </Text>
            <Text style={[styles.winStat, { color: colors.textMuted }]}>
              {t("win.undosUsed", { undos: gameState.undosUsed })}
            </Text>

            {!submitted && (
              <>
                <TextInput
                  style={[
                    styles.nameInput,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  value={playerName}
                  onChangeText={setPlayerName}
                  placeholder={t("win.enterName")}
                  placeholderTextColor={colors.textMuted}
                  maxLength={MAX_NAME_LENGTH}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmitScore()}
                />

                {submitError && (
                  <Text style={[styles.errorText, { color: colors.error ?? "#e53e3e" }]}>
                    {t("error.submitFailed")}
                  </Text>
                )}

                <Pressable
                  style={[
                    styles.modalBtn,
                    { backgroundColor: colors.accent },
                    (!playerName.trim() || submitting) && styles.modalBtnDisabled,
                  ]}
                  onPress={() => void handleSubmitScore()}
                  disabled={!playerName.trim() || submitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("win.submitScore")}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textOnAccent }]}>
                    {submitting ? t("win.submitting") : t("win.submitScore")}
                  </Text>
                </Pressable>
              </>
            )}

            {submitted && winEntry && (
              <Text style={[styles.rankText, { color: colors.accent }]}>
                {t("win.rank", { rank: winEntry.rank })}
              </Text>
            )}

            <View style={styles.modalActions}>
              {submitted && (currentLevelId ?? 0) < levels.length && (
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                  onPress={handleNextLevel}
                  accessibilityRole="button"
                  accessibilityLabel={t("win.nextLevel")}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textOnAccent }]}>
                    {t("win.nextLevel")}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary, { borderColor: colors.border }]}
                onPress={handleBackToSelect}
                accessibilityRole="button"
                accessibilityLabel={t("win.backToLevels")}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>
                  {t("win.backToLevels")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderLeaderboard() {
    if (leaderboardLoading) {
      return <ActivityIndicator style={styles.leaderboardLoading} />;
    }
    if (leaderboard.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t("leaderboard.empty")}
        </Text>
      );
    }
    return (
      <FlatList
        data={leaderboard}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.leaderboardList}
        renderItem={({ item, index }) => (
          <View style={[styles.leaderboardRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.leaderboardRank, { color: colors.textMuted }]}>
              #{index + 1}
            </Text>
            <Text style={[styles.leaderboardName, { color: colors.text }]}>
              {item.player_name}
            </Text>
            <Text style={[styles.leaderboardLevel, { color: colors.accent }]}>
              {t("leaderboard.levelReached", { level: item.level_reached })}
            </Text>
          </View>
        )}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  if (view === "loading") {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (view === "select") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.selectHeader, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={[styles.backBtnText, { color: colors.accent }]}>‹</Text>
          </Pressable>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            {t("game.title")}
          </Text>
          <View style={styles.backBtn} />
        </View>

        {/* Error banner */}
        {loadError && (
          <Text style={[styles.loadError, { color: colors.error ?? "#e53e3e" }]}>
            {t("error.loadFailed")}
          </Text>
        )}

        {/* Tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(["levels", "leaderboard"] as SelectTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tab,
                selectTab === tab && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
              ]}
              onPress={() => handleSelectTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectTab === tab }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selectTab === tab ? colors.accent : colors.textMuted },
                ]}
              >
                {t(`tab.${tab}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {selectTab === "levels" ? (
          <LevelSelectScreen
            levels={levels}
            progress={progress}
            onSelectLevel={handleSelectLevel}
            onContinue={handleContinue}
          />
        ) : (
          <View style={styles.leaderboardContainer}>{renderLeaderboard()}</View>
        )}
      </View>
    );
  }

  // view === "play"
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* HUD */}
      <View style={[styles.hud, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleBackToSelect}
          style={styles.hudBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to levels"
        >
          <Text style={[styles.hudBtnText, { color: colors.accent }]}>‹</Text>
        </Pressable>

        <View style={styles.hudCenter}>
          <Text style={[styles.hudLevel, { color: colors.text }]}>
            {t("hud.level", { level: currentLevelId })}
          </Text>
          <Text style={[styles.hudMeta, { color: colors.textMuted }]}>
            {t("hud.moves", { moves: gameState?.moveCount ?? 0 })}
            {"  "}
            {t("hud.undos", { undos: gameState?.undosUsed ?? 0 })}
          </Text>
        </View>

        <View style={styles.hudActions}>
          <Pressable
            onPress={handleUndo}
            style={[styles.hudActionBtn, { opacity: history.length > 0 ? 1 : 0.35 }]}
            disabled={history.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t("action.undo")}
          >
            <Text style={[styles.hudActionText, { color: colors.text }]}>
              {t("action.undo")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleHint}
            style={styles.hudActionBtn}
            accessibilityRole="button"
            accessibilityLabel={t("action.hint")}
          >
            <Text style={[styles.hudActionText, { color: colors.text }]}>
              {t("action.hint")}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Board */}
      <View style={styles.boardContainer}>
        {gameState && (
          <SortBoard
            state={gameState}
            colorblindMode={colorblindMode}
            onBottleTap={handleBottleTap}
          />
        )}
      </View>

      {/* Colorblind toggle */}
      <Pressable
        onPress={() => setColorblindMode((m) => !m)}
        style={styles.colorblindToggle}
        accessibilityRole="switch"
        accessibilityLabel={t("action.colorblindToggle")}
        accessibilityState={{ checked: colorblindMode }}
      >
        <Text style={[styles.colorblindToggleText, { color: colors.textMuted }]}>
          {t("settings.colorblindMode")}
        </Text>
      </Pressable>

      {renderWinModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },

  // Select view
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: "center" },
  backBtnText: { fontSize: 28, lineHeight: 32, fontFamily: "System" },
  screenTitle: { flex: 1, textAlign: "center", fontFamily: typography.heading, fontSize: 18 },
  loadError: { textAlign: "center", padding: 8, fontFamily: typography.body, fontSize: 13 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabText: { fontFamily: typography.label, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 },
  leaderboardContainer: { flex: 1 },
  leaderboardLoading: { marginTop: 32 },
  leaderboardList: { padding: 16, gap: 0 },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  leaderboardRank: { fontFamily: typography.label, fontSize: 13, width: 28 },
  leaderboardName: { flex: 1, fontFamily: typography.body, fontSize: 14 },
  leaderboardLevel: { fontFamily: typography.label, fontSize: 13 },
  emptyText: { textAlign: "center", marginTop: 32, fontFamily: typography.body, fontSize: 14 },

  // Play view — HUD
  hud: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  hudBtn: { width: 36, alignItems: "center" },
  hudBtnText: { fontSize: 28, lineHeight: 32 },
  hudCenter: { flex: 1, alignItems: "center" },
  hudLevel: { fontFamily: typography.heading, fontSize: 16 },
  hudMeta: { fontFamily: typography.body, fontSize: 11 },
  hudActions: { flexDirection: "row", gap: 4 },
  hudActionBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  hudActionText: { fontFamily: typography.label, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },

  boardContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },

  colorblindToggle: { alignItems: "center", paddingVertical: 8 },
  colorblindToggleText: { fontFamily: typography.body, fontSize: 11 },

  // Win modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    gap: 12,
    alignItems: "stretch",
  },
  winTitle: { fontFamily: typography.heading, fontSize: 28, textAlign: "center" },
  winStat: { fontFamily: typography.body, fontSize: 14, textAlign: "center" },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.body,
    fontSize: 16,
  },
  errorText: { fontFamily: typography.body, fontSize: 12, textAlign: "center" },
  rankText: { fontFamily: typography.heading, fontSize: 24, textAlign: "center" },
  modalActions: { gap: 8 },
  modalBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnSecondary: { borderWidth: 1 },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnText: { fontFamily: typography.label, fontSize: 14, fontWeight: "600" },
});
