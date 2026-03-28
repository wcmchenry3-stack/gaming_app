import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { PlayerStateResponse } from "../../api/ludoClient";
import { PLAYER_COLORS } from "./boardLayout";

interface Props {
  playerStates: PlayerStateResponse[];
  currentPlayer: string;
  humanPlayer: string;
  cpuPlayer: string | null;
}

export default function PlayerStatus({ playerStates, currentPlayer, humanPlayer, cpuPlayer }: Props) {
  const { t } = useTranslation("ludo");
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {playerStates.map((ps) => {
        const isCurrent = ps.player_id === currentPlayer;
        const isHuman = ps.player_id === humanPlayer;
        const label = isHuman ? t("player.you") : t("player.cpu");
        const dotColor = PLAYER_COLORS[ps.player_id] ?? "#888";

        return (
          <View
            key={ps.player_id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: isCurrent ? dotColor : colors.border,
                borderWidth: isCurrent ? 2 : 1,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.counts, { color: colors.textMuted }]}>
                {t("status.piecesInBase", { count: ps.pieces_home })}
                {"  "}
                {t("status.piecesFinished", { count: ps.pieces_finished })}
              </Text>
            </View>
            {isCurrent && (
              <Text style={[styles.turnBadge, { color: dotColor }]}>
                {isHuman ? t("status.yourTurn") : t("status.cpuTurn")}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 140,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
  },
  counts: {
    fontSize: 11,
    marginTop: 1,
  },
  turnBadge: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
