import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { placeBet as enginePlaceBet, toViewState, DEFAULT_RULES } from "../game/blackjack/engine";
import { useBlackjackGame } from "../game/blackjack/BlackjackGameContext";
import BettingPanel from "../components/blackjack/BettingPanel";
import BlackjackTable from "../components/blackjack/BlackjackTable";
import BlackjackHeader from "../components/blackjack/BlackjackHeader";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "BlackjackBetting">;
};

export default function BlackjackBettingScreen({ navigation }: Props) {
  const { t } = useTranslation(["blackjack", "common"]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { engine, loading, error, apply, handleRulesChange } = useBlackjackGame();

  // Redirect to TableScreen if loaded mid-hand (app restart, or injected state).
  useEffect(() => {
    if (!loading && engine && engine.phase !== "betting") {
      navigation.replace("BlackjackTable");
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
  const handleDeal = (amount: number) => apply((s) => enginePlaceBet(s, amount));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      {/* Shared header with bankroll */}
      <BlackjackHeader chips={state?.chips ?? 1000} onBack={() => navigation.goBack()} />

      {/* Phase label */}
      {state && (
        <Text style={[styles.phaseLabel, { color: colors.textMuted }]}>
          {t(`blackjack:phase.${state.phase}` as Parameters<typeof t>[0])}
        </Text>
      )}

      {/*
       * GH #226 — Table is always rendered so the felt is visible between hands.
       */}
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

      {/* Betting controls */}
      <View style={styles.controls}>
        <BettingPanel
          chips={state?.chips ?? 1000}
          onDeal={handleDeal}
          loading={false}
          error={error}
          rules={state?.rules ?? DEFAULT_RULES}
          onRulesChange={handleRulesChange}
        />
      </View>
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
  phaseLabel: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 4,
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
});
