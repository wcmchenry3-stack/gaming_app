import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { BlackjackState } from "../game/blackjack/types";
import {
  newGame,
  placeBet as enginePlaceBet,
  hit as engineHit,
  stand as engineStand,
  doubleDown as engineDoubleDown,
  newHand as engineNewHand,
  toViewState,
  EngineState,
} from "../game/blackjack/engine";
import { saveGame, loadGame, clearGame } from "../game/blackjack/storage";
import BettingPanel from "../components/blackjack/BettingPanel";
import BlackjackTable from "../components/blackjack/BlackjackTable";
import ActionButtons from "../components/blackjack/ActionButtons";
import ResultBanner from "../components/blackjack/ResultBanner";
import GameOverModal from "../components/blackjack/GameOverModal";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Blackjack">;
};

export default function BlackjackScreen({ navigation }: Props) {
  const { t } = useTranslation(["blackjack", "common", "errors"]);
  const { colors, theme, toggle } = useTheme();

  const [engine, setEngine] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved game or start fresh
  useEffect(() => {
    let active = true;
    loadGame()
      .then((saved) => {
        if (!active) return;
        const next = saved ?? newGame();
        setEngine(next);
        if (!saved) saveGame(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Clear storage when the player runs out of chips so relaunch starts fresh.
  useEffect(() => {
    if (engine && engine.chips === 0 && engine.phase === "result") {
      clearGame();
    }
  }, [engine]);

  const apply = useCallback(
    (fn: (s: EngineState) => EngineState) => {
      if (!engine) return;
      setError(null);
      try {
        const next = fn(engine);
        setEngine(next);
        saveGame(next);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine]
  );

  const handleDeal = (amount: number) => apply((s) => enginePlaceBet(s, amount));
  const handleHit = () => apply(engineHit);
  const handleStand = () => apply(engineStand);
  const handleDoubleDown = () => apply(engineDoubleDown);
  const handleNextHand = () => apply(engineNewHand);
  const handlePlayAgain = () => {
    const fresh = newGame();
    setEngine(fresh);
    saveGame(fresh);
    setError(null);
  };

  if (!engine && loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const state: BlackjackState | null = engine ? toViewState(engine) : null;

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

        <Text style={[styles.title, { color: colors.text }]}>{t("blackjack:game.title")}</Text>

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
          {t(`blackjack:phase.${state.phase}` as Parameters<typeof t>[0])}
        </Text>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {(!state || state.phase === "betting") && (
          <BettingPanel
            chips={state?.chips ?? 1000}
            onDeal={handleDeal}
            loading={false}
            error={error}
          />
        )}

        {state && state.phase !== "betting" && (
          <>
            <BlackjackTable
              playerHand={state.player_hand}
              dealerHand={state.dealer_hand}
              phase={state.phase}
            />

            {state.phase === "result" && (
              <>
                <ResultBanner outcome={state.outcome!} payout={state.payout} />

                <View style={styles.resultActions}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                    onPress={handleNextHand}
                    accessibilityRole="button"
                    accessibilityLabel={t("blackjack:actions.nextHandLabel")}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.surface }]}>
                      {t("blackjack:actions.nextHand")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionBtn, styles.quitBtn, { borderColor: colors.border }]}
                    onPress={() => navigation.navigate("Home")}
                    accessibilityRole="button"
                    accessibilityLabel={t("blackjack:actions.quitLabel")}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>
                      {t("blackjack:actions.quit")}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {state.phase === "player" && (
              <ActionButtons
                onHit={handleHit}
                onStand={handleStand}
                onDoubleDown={handleDoubleDown}
                doubleDownAvailable={state.double_down_available}
                loading={false}
              />
            )}
          </>
        )}

        {state && state.phase !== "betting" && error && (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        )}
      </View>

      {state && (
        <GameOverModal
          visible={state.game_over}
          onPlayAgain={handlePlayAgain}
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
    marginBottom: 16,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 28,
  },
  resultActions: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
  },
  actionBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  quitBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    textAlign: "center",
  },
});
