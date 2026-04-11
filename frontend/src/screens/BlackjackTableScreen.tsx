import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import {
  hit as engineHit,
  stand as engineStand,
  doubleDown as engineDoubleDown,
  split as engineSplit,
  newHand as engineNewHand,
  toViewState,
} from "../game/blackjack/engine";
import { useBlackjackGame } from "../game/blackjack/BlackjackGameContext";
import BlackjackTable from "../components/blackjack/BlackjackTable";
import ActionButtons from "../components/blackjack/ActionButtons";
import ResultBanner from "../components/blackjack/ResultBanner";
import GameOverModal from "../components/blackjack/GameOverModal";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "BlackjackTable">;
};

export default function BlackjackTableScreen({ navigation }: Props) {
  const { t } = useTranslation(["blackjack", "common"]);
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { engine, loading, error, apply, handlePlayAgain } = useBlackjackGame();

  // Redirect to BettingScreen when Next Hand transitions phase back to betting.
  useEffect(() => {
    if (!loading && engine && engine.phase === "betting") {
      navigation.replace("BlackjackBetting");
    }
  }, [loading, engine, navigation]);

  if (!engine && loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const state = engine ? toViewState(engine) : null;

  const handleHit = () => apply(engineHit);
  const handleStand = () => apply(engineStand);
  const handleDoubleDown = () => apply(engineDoubleDown);
  const handleSplit = () => apply(engineSplit);
  const handleNextHand = () => apply(engineNewHand);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      {/* Header — back navigates to MainTabs to preserve the same behaviour as
          the single-screen design: pressing back from anywhere in Blackjack
          returns to Home. */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
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

      {/*
       * GH #227 — Chip balance visible during player and result phases.
       */}
      {state && state.phase !== "betting" && (
        <Text
          style={[styles.chipStrip, { color: colors.text }]}
          accessibilityLabel={t("blackjack:chips.accessibilityLabel", { chips: state.chips })}
        >
          {t("blackjack:chips.display", { chips: state.chips })}
        </Text>
      )}

      {/* Table */}
      {state && (
        <View style={styles.tableArea}>
          <BlackjackTable
            playerHand={state.player_hand}
            dealerHand={state.dealer_hand}
            phase={state.phase}
            playerHands={state.player_hands}
            activeHandIndex={state.active_hand_index}
            handBets={state.hand_bets}
            handOutcomes={state.hand_outcomes}
          />
        </View>
      )}

      {/* Phase-specific controls */}
      <View style={styles.controls}>
        {state?.phase === "result" && (
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
                onPress={() => navigation.goBack()}
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

        {state?.phase === "player" && (
          <ActionButtons
            onHit={handleHit}
            onStand={handleStand}
            onDoubleDown={handleDoubleDown}
            onSplit={handleSplit}
            doubleDownAvailable={state.double_down_available}
            splitAvailable={state.split_available}
            loading={false}
          />
        )}

        {state && state.phase !== "betting" && error && (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        )}
      </View>

      {state && (
        <GameOverModal
          visible={state.game_over}
          onPlayAgain={handlePlayAgain}
          onHome={() => navigation.goBack()}
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
    marginBottom: 4,
  },
  chipStrip: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  tableArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  controls: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
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
