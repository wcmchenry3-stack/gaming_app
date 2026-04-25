import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { GameShell } from "../components/shared/GameShell";
import { useTheme } from "../theme/ThemeContext";
import HeartsScoreboard from "../components/scoreboard/HeartsScoreboard";
import { useHeartsRounds } from "../game/hearts/RoundsContext";
import type { HomeStackParamList } from "../../App";

type GameKey = HomeStackParamList["Scoreboard"]["gameKey"];

function HeartsScoreboardSection() {
  const { cumulativeScores, scoreHistory, playerLabels } = useHeartsRounds();
  return (
    <HeartsScoreboard
      playerLabels={playerLabels}
      cumulativeScores={cumulativeScores}
      scoreHistory={scoreHistory}
    />
  );
}

function UnknownScoreboardFallback({ gameKey }: { gameKey: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fallback}>
      <Text style={[styles.fallbackText, { color: colors.textMuted }]}>
        No scoreboard available for &quot;{gameKey}&quot; yet.
      </Text>
    </View>
  );
}

export default function ScoreboardScreen() {
  const { t } = useTranslation("common");
  const navigation = useNavigation();
  const route = useRoute<RouteProp<HomeStackParamList, "Scoreboard">>();
  const gameKey: GameKey = route.params.gameKey;

  let body: React.ReactNode;
  switch (gameKey) {
    case "hearts":
      body = <HeartsScoreboardSection />;
      break;
    case "yacht":
      body = <UnknownScoreboardFallback gameKey={gameKey} />;
      break;
    case "blackjack":
      body = <UnknownScoreboardFallback gameKey={gameKey} />;
      break;
    default:
      body = <UnknownScoreboardFallback gameKey={gameKey} />;
  }

  return (
    <GameShell title={t("overflow.menu.scoreboard")} onBack={() => navigation.goBack()}>
      <View style={styles.body}>{body}</View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 14,
  },
});
